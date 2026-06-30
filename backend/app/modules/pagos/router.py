from typing import Annotated
from fastapi import APIRouter, Depends, Request, status

from app.core.deps import get_current_active_user
from app.modules.auth.usuario import Usuario
from app.schemas.pago_schema import (
    CrearPagoRequest, PagoResponse,
    PreferenciaRequest, PreferenciaResponse, ConfirmarPagoRequest,
)
from app.modules.pagos.service import (
    crear_pago, crear_preferencia, verificar_pago,
    procesar_webhook, procesar_merchant_order, get_pago_por_pedido,
)
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/pagos", tags=["Pagos"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]
UserDep = Annotated[Usuario, Depends(get_current_active_user)]


@router.post("/crear", response_model=PagoResponse, status_code=status.HTTP_201_CREATED)
def crear_pago_endpoint(body: CrearPagoRequest, uow: UoWDep, current_user: UserDep):
    return crear_pago(uow, current_user.id, body)


@router.post("/preferencia", response_model=PreferenciaResponse, status_code=status.HTTP_201_CREATED)
def crear_preferencia_endpoint(body: PreferenciaRequest, uow: UoWDep, current_user: UserDep):
    """Checkout PRO: devuelve el init_point para redirigir al cliente a MercadoPago."""
    return crear_preferencia(uow, current_user.id, body.pedido_id)


@router.post("/confirmar")
def confirmar_endpoint(body: ConfirmarPagoRequest, uow: UoWDep, current_user: UserDep):
    """
    Al volver de Checkout PRO, el front manda el payment_id (de la URL de retorno).
    Re-consulta el pago en MP y, si está aprobado, confirma el pedido + notifica WS.
    """
    procesar_webhook(uow, body.payment_id)
    return {"status": "ok"}


@router.post("/verificar")
def verificar_endpoint(body: PreferenciaRequest, uow: UoWDep, current_user: UserDep):
    """
    Verifica el estado del pago de un pedido buscándolo en MercadoPago por
    external_reference (no depende del redirect). Confirma el pedido si está aprobado.
    """
    return verificar_pago(uow, current_user.id, body.pedido_id)


@router.get("/webhook")
async def webhook_get(request: Request):
    """MP usa GET para verificar que la URL existe antes de registrarla."""
    return {"status": "ok"}


@router.post("/webhook")
async def webhook(request: Request, uow: UoWDep):
    """IPN de MercadoPago. Acepta el id por body JSON o por query params."""
    payment_id = None
    try:
        body = await request.json()
    except Exception:
        body = {}

    qp = request.query_params
    topic = qp.get("topic") or qp.get("type") or body.get("topic") or body.get("type")

    # 1) Notificación de PAGO directa: { "type": "payment", "data": { "id": "123" } }
    if topic == "payment":
        payment_id = (body.get("data") or {}).get("id") or qp.get("id") or qp.get("data.id")
        if payment_id:
            procesar_webhook(uow, str(payment_id))
        return {"status": "ok"}

    # 2) Notificación de MERCHANT_ORDER (Checkout PRO): adentro vienen los pagos.
    if topic == "merchant_order":
        mo_id = qp.get("id")
        if not mo_id:
            resource = body.get("resource", "") or ""   # ej: ".../merchant_orders/123"
            mo_id = resource.rstrip("/").split("/")[-1] if resource else None
        if mo_id:
            procesar_merchant_order(uow, str(mo_id))

    return {"status": "ok"}


@router.get("/{pedido_id}", response_model=PagoResponse)
def get_pago(pedido_id: int, uow: UoWDep, current_user: UserDep):
    return get_pago_por_pedido(uow, pedido_id, current_user.id, current_user.roles)