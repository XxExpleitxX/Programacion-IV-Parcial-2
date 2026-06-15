"""
Servicio de pagos — MercadoPago Checkout PRO (CardPayment / API).

Flujo:
  1. El frontend tokeniza la tarjeta con MP.js (PCI) y manda el token.
  2. crear_pago() arma el pago, genera idempotency_key (UUID) y lo manda al SDK.
  3. Si MP lo aprueba, se confirma el pedido (PENDIENTE → CONFIRMADO).
  4. El webhook IPN re-consulta el pago en MP y sincroniza estado (fuente de verdad: MP).
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

import mercadopago
from fastapi import HTTPException, status

from app.core.mercado_pago_cliente import get_sdk
from app.modules.pagos.pago import Pago
from app.modules.pedidos.historial_estado_pedido import HistorialEstadoPedido
from app.schemas.pago_schema import CrearPagoRequest
from app.unit_of_work import UnitOfWork


# URL de la tienda para las back_urls de Checkout PRO (a dónde vuelve el cliente).
FRONT_URL = "http://localhost:5173"


def crear_preferencia(uow: UnitOfWork, usuario_id: int, pedido_id: int) -> dict:
    """
    Checkout PRO: crea una preferencia con los items del pedido y devuelve el
    init_point (URL de la página de pago de MercadoPago). Registra un Pago
    PENDIENTE enlazado por external_reference para confirmar luego.
    """
    pedido = uow.pedidos.get_by_id(pedido_id)
    if not pedido or pedido.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if pedido.usuario_id != usuario_id:
        raise HTTPException(status_code=403, detail="El pedido no te pertenece.")
    if pedido.estado_codigo != "PENDIENTE":
        raise HTTPException(status_code=409, detail="El pedido no está pendiente de pago.")

    external_reference = str(uuid4())
    items = [
        {
            "title":       d.nombre_snapshot,
            "quantity":    d.cantidad,
            "unit_price":  float(d.precio_snapshot),
            "currency_id": "ARS",
        }
        for d in pedido.detalles
    ]
    preference_data = {
        "items": items,
        "external_reference": external_reference,
        "back_urls": {
            "success": f"{FRONT_URL}/pedidos/{pedido.id}",
            "failure": f"{FRONT_URL}/pedidos/{pedido.id}",
            "pending": f"{FRONT_URL}/pedidos/{pedido.id}",
        },
        # Sin "auto_return": MercadoPago lo rechaza con back_urls localhost.
        # El cliente vuelve con el botón "Volver al sitio" de la página de MP.
    }

    try:
        result = get_sdk().preference().create(preference_data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error creando la preferencia en MercadoPago: {e}")

    http_status = result.get("status")
    resp = result.get("response", {}) or {}
    if isinstance(http_status, int) and http_status >= 400:
        msg = resp.get("message") or resp.get("error") or "revisá las credenciales (MP_ACCESS_TOKEN)"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MercadoPago rechazó la preferencia ({http_status}): {msg}",
        )

    init_point = resp.get("init_point") or resp.get("sandbox_init_point")
    if not init_point:
        raise HTTPException(status_code=502, detail=f"MercadoPago no devolvió init_point: {resp}")

    # Pago PENDIENTE para enlazar el resultado por external_reference (lo usa procesar_webhook).
    pago = Pago(
        pedido_id          = pedido.id,
        mp_payment_id      = None,
        mp_status          = "pending",
        mp_status_detail   = "preferencia creada (Checkout PRO)",
        external_reference = external_reference,
        idempotency_key    = str(uuid4()),
        transaction_amount = pedido.total,
        payment_method_id  = None,
    )
    uow.pagos.create(pago)
    uow.flush()

    return {
        "preference_id": resp.get("id", ""),
        "init_point":    init_point,
        "pedido_id":     pedido.id,
    }


def _confirmar_pedido(uow: UnitOfWork, pedido) -> None:
    """PENDIENTE → CONFIRMADO + historial (sistema). Idempotente."""
    if pedido.estado_codigo != "PENDIENTE":
        return
    desde = pedido.estado_codigo
    pedido.estado_codigo = "CONFIRMADO"
    pedido.updated_at = datetime.utcnow()
    uow.pedidos.add(pedido)
    uow.historial.append(HistorialEstadoPedido(
        pedido_id    = pedido.id,
        estado_desde = desde,
        estado_hacia = "CONFIRMADO",
        usuario_id   = None,                      # sistema (webhook/pago), no un usuario
        motivo       = "Pago aprobado (MercadoPago)",
    ))
    uow.emit_pedido_event(pedido.id, {
        "event":           "pago_confirmado",
        "pedido_id":       pedido.id,
        "estado_anterior": desde,
        "estado_nuevo":    "CONFIRMADO",
        "usuario_id":      None,
        "motivo":          "Pago aprobado (MercadoPago)",
    })


def crear_pago(uow: UnitOfWork, usuario_id: int, data: CrearPagoRequest) -> Pago:
    pedido = uow.pedidos.get_by_id(data.pedido_id)
    if not pedido or pedido.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if pedido.usuario_id != usuario_id:
        raise HTTPException(status_code=403, detail="El pedido no te pertenece.")
    if pedido.estado_codigo != "PENDIENTE":
        raise HTTPException(status_code=409, detail="El pedido no está pendiente de pago.")
    for p in uow.pagos.get_by_pedido(pedido.id):
        if p.mp_status == "approved":
            raise HTTPException(status_code=409, detail="El pedido ya tiene un pago aprobado.")

    idempotency_key   = str(uuid4())
    external_reference = str(uuid4())

    payment_data = {
        "transaction_amount": float(pedido.total),
        "token":              data.token,
        "installments":       data.installments,
        "payment_method_id":  data.payment_method_id,
        "payer":              {"email": data.payer_email},
        "external_reference": external_reference,
    }
    if data.issuer_id:
        payment_data["issuer_id"] = data.issuer_id

    # idempotency_key en header X-Idempotency-Key → evita cobros duplicados
    request_options = mercadopago.config.RequestOptions()
    request_options.custom_headers = {"x-idempotency-key": idempotency_key}

    try:
        result = get_sdk().payment().create(payment_data, request_options)
        print("MP RESULT:", result)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error comunicándose con MercadoPago: {e}")

    # result = {"status": <http_code>, "response": <body>}.
    # Si MP devolvió un error de API (401 credenciales, 400 request inválido, etc.),
    # NO es un resultado de pago → error claro, sin persistir un Pago basura.
    http_status = result.get("status")
    resp = result.get("response", {}) or {}
    if isinstance(http_status, int) and http_status >= 400:
        msg = resp.get("message") or resp.get("error") or "revisá las credenciales (MP_ACCESS_TOKEN)"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MercadoPago rechazó la solicitud ({http_status}): {msg}",
        )
    if "status" not in resp:
        raise HTTPException(status_code=502, detail=f"MercadoPago rechazó la solicitud: {resp}")

    pago = Pago(
        pedido_id          = pedido.id,
        mp_payment_id      = resp.get("id"),
        mp_status          = resp.get("status", "unknown"),
        mp_status_detail   = resp.get("status_detail"),
        external_reference = external_reference,
        idempotency_key    = idempotency_key,
        transaction_amount = pedido.total,
        payment_method_id  = resp.get("payment_method_id") or data.payment_method_id,
    )
    uow.pagos.create(pago)
    uow.flush()

    if pago.mp_status == "approved":
        _confirmar_pedido(uow, pedido)

    uow.flush()
    uow.refresh(pago)
    return pago


def verificar_pago(uow: UnitOfWork, usuario_id: int, pedido_id: int) -> dict:
    """
    Checkout PRO sin webhook público: al volver, el front pide verificar.
    Busca el pago en MercadoPago por external_reference; si está aprobado,
    sincroniza el Pago y confirma el pedido (+ evento WS).
    """
    pedido = uow.pedidos.get_by_id(pedido_id)
    if not pedido or pedido.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if pedido.usuario_id != usuario_id:
        raise HTTPException(status_code=403, detail="El pedido no te pertenece.")

    pagos = [p for p in uow.pagos.get_by_pedido(pedido_id) if p.external_reference]
    if not pagos:
        raise HTTPException(status_code=404, detail="No hay un pago para verificar.")
    pago = pagos[-1]

    try:
        res = get_sdk().payment().search(filters={"external_reference": pago.external_reference})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando MercadoPago: {e}")

    resultados = ((res.get("response") or {}).get("results")) or []
    if resultados:
        mp = resultados[0]
        pago.mp_payment_id    = mp.get("id", pago.mp_payment_id)
        pago.mp_status        = mp.get("status", pago.mp_status)
        pago.mp_status_detail = mp.get("status_detail")
        pago.payment_method_id = mp.get("payment_method_id") or pago.payment_method_id
        pago.updated_at       = datetime.utcnow()
        uow.pagos.add(pago)
        if pago.mp_status == "approved":
            _confirmar_pedido(uow, pedido)
        uow.flush()

    return {"estado": pedido.estado_codigo, "mp_status": pago.mp_status}


def procesar_webhook(uow: UnitOfWork, payment_id: str) -> Optional[int]:
    """
    IPN: re-consulta el pago en MP (no confía en el body) y sincroniza.
    Devuelve el pedido_id afectado (para el broadcast WS) o None.
    """
    try:
        result = get_sdk().payment().get(payment_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando el pago en MercadoPago: {e}")

    resp = result.get("response", {}) or {}
    ext_ref = resp.get("external_reference")

    pago = uow.pagos.get_by_external_reference(ext_ref) if ext_ref else None
    if not pago and resp.get("id"):
        pago = uow.pagos.get_by_mp_payment_id(resp["id"])
    if not pago:
        return None   # notificación que no corresponde a un pago nuestro

    pago.mp_payment_id    = resp.get("id", pago.mp_payment_id)
    pago.mp_status        = resp.get("status", pago.mp_status)
    pago.mp_status_detail = resp.get("status_detail")
    pago.updated_at       = datetime.utcnow()
    uow.pagos.add(pago)

    pedido = uow.pedidos.get_by_id(pago.pedido_id)
    if pago.mp_status == "approved" and pedido:
        _confirmar_pedido(uow, pedido)

    uow.flush()
    return pago.pedido_id


def get_pago_por_pedido(uow: UnitOfWork, pedido_id: int, usuario_id: int, roles: list[str]) -> Pago:
    pedido = uow.pedidos.get_by_id(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    es_admin = any(r in ("ADMIN", "PEDIDOS") for r in roles)
    if not es_admin and pedido.usuario_id != usuario_id:
        raise HTTPException(status_code=403, detail="Acceso denegado.")
    pagos = uow.pagos.get_by_pedido(pedido_id)
    if not pagos:
        raise HTTPException(status_code=404, detail="El pedido no tiene pagos registrados.")
    return pagos[-1]  # devuelvo el pago más reciente (puede haber varios por reintentos, pero el último es el válido)