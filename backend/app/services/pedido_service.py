"""
PedidoService — FSM de estados + lógica de negocio.

CAMBIOS (devolución del profe):
  - El service ya NO usa uow.session directamente.
    Todo acceso a la BD pasa por los repositorios (uow.pedidos, uow.detalles,
    uow.historial, uow.productos, uow.formas_pago).
  - El historial se inserta con uow.historial.append(...) (antes era session.add).
  - El service NUNCA comitea (el commit lo hace el UoW automáticamente).
    Solo usa flush() (para obtener el id del pedido) y refresh().

FSM:
  PENDIENTE  → CONFIRMADO | CANCELADO
  CONFIRMADO → EN_PREP    | CANCELADO
  EN_PREP    → ENTREGADO  | CANCELADO  (cancelar desde acá: solo ADMIN/PEDIDOS)
  ENTREGADO  → (terminal)
  CANCELADO  → (terminal)
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status

from app.models.pedido import Pedido
from app.models.detalle_pedido import DetallePedido
from app.models.historial_estado_pedido import HistorialEstadoPedido
from app.schemas.pago_schema import PedidoCreate, AvanzarEstadoRequest
from app.unit_of_work import UnitOfWork


FSM: dict[str, list[str]] = {
    "PENDIENTE":  ["CONFIRMADO", "CANCELADO"],
    "CONFIRMADO": ["EN_PREP",    "CANCELADO"],
    "EN_PREP":    ["ENTREGADO",  "CANCELADO"],
    "ENTREGADO":  [],
    "CANCELADO":  [],
}

ESTADOS_CANCELABLE_POR_CLIENT = {"PENDIENTE", "CONFIRMADO"}
ROLES_ADMIN_PEDIDOS = {"ADMIN", "PEDIDOS"}


def _validar_transicion(estado_actual: str, estado_hacia: str, roles: list[str]) -> None:
    permitidos = FSM.get(estado_actual, [])
    if estado_hacia not in permitidos:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Transición inválida: {estado_actual} → {estado_hacia}. Permitidas: {permitidos}",
        )
    if estado_actual == "EN_PREP" and estado_hacia == "CANCELADO":
        if not any(r in ROLES_ADMIN_PEDIDOS for r in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo ADMIN o PEDIDOS pueden cancelar desde EN_PREP.",
            )
    if "CLIENT" in roles and not any(r in ROLES_ADMIN_PEDIDOS for r in roles):
        if estado_hacia not in ("CANCELADO",):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Los clientes solo pueden cancelar pedidos.",
            )


class PedidoService:

    @staticmethod
    def crear_pedido(uow: UnitOfWork, usuario_id: int, data: PedidoCreate) -> Pedido:
        # ── Forma de pago: vía repo (antes: uow.session.get) ──────────────
        forma = uow.formas_pago.get_by_id(data.forma_pago_codigo)
        if not forma or not forma.habilitado:
            raise HTTPException(status_code=422, detail="Forma de pago no válida.")

        detalles: list[DetallePedido] = []
        subtotal = Decimal("0.00")

        for item in data.items:
            # ── Producto: vía repo (antes: uow.session.get) ───────────────
            producto = uow.productos.get_by_id(item.producto_id)
            if not producto or producto.deleted_at is not None:
                raise HTTPException(status_code=422, detail=f"Producto {item.producto_id} no encontrado.")
            if not producto.disponible:
                raise HTTPException(status_code=422, detail=f"Producto '{producto.nombre}' no disponible.")

            precio = Decimal(str(producto.precio_base))
            sub = precio * item.cantidad
            subtotal += sub

            # Snapshot: precio y nombre quedan congelados en el detalle
            detalles.append(DetallePedido(
                producto_id     = item.producto_id,
                cantidad        = item.cantidad,
                nombre_snapshot = producto.nombre,
                precio_snapshot = precio,
                subtotal_snap   = sub,
                personalizacion = item.personalizacion,
            ))

        costo_envio = Decimal("50.00") if data.direccion_id else Decimal("0.00")
        total = subtotal + costo_envio

        pedido = Pedido(
            usuario_id        = usuario_id,
            direccion_id      = data.direccion_id,
            estado_codigo     = "PENDIENTE",
            forma_pago_codigo = data.forma_pago_codigo,
            subtotal          = subtotal,
            descuento         = Decimal("0.00"),
            costo_envio       = costo_envio,
            total             = total,
            notas             = data.notas,
        )
        # ── Alta del pedido: vía repo + flush para obtener el id ──────────
        uow.pedidos.add(pedido)
        uow.flush()                         # genera pedido.id (NO comitea)

        # ── Detalles: vía repo (antes: uow.session.add por cada uno) ──────
        for d in detalles:
            d.pedido_id = pedido.id
        uow.detalles.bulk_create(detalles)

        # ── Audit trail: vía HistorialEstadoPedidoRepository ──────────────
        uow.historial.append(HistorialEstadoPedido(
            pedido_id    = pedido.id,
            estado_desde = None,
            estado_hacia = "PENDIENTE",
            usuario_id   = usuario_id,
            motivo       = "Pedido creado",
        ))

        uow.flush()
        uow.refresh(pedido)
        return pedido                       # el commit lo hace el UoW al cerrar

    @staticmethod
    def avanzar_estado(
        uow: UnitOfWork,
        pedido_id: int,
        usuario_id: int,
        roles: list[str],
        data: AvanzarEstadoRequest,
    ) -> Pedido:
        # ── Buscar pedido: vía repo ───────────────────────────────────────
        pedido = uow.pedidos.get_by_id(pedido_id)
        if not pedido or pedido.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")

        estado_actual = pedido.estado_codigo
        estado_hacia  = data.estado_hacia.upper()

        if estado_hacia == "CANCELADO" and not data.motivo:
            raise HTTPException(status_code=422, detail="motivo es obligatorio al cancelar.")

        if "CLIENT" in roles and not any(r in ROLES_ADMIN_PEDIDOS for r in roles):
            if pedido.usuario_id != usuario_id:
                raise HTTPException(status_code=403, detail="Acceso denegado.")
            if estado_actual not in ESTADOS_CANCELABLE_POR_CLIENT:
                raise HTTPException(
                    status_code=403,
                    detail="Solo podés cancelar desde PENDIENTE o CONFIRMADO.",
                )

        _validar_transicion(estado_actual, estado_hacia, roles)

        pedido.estado_codigo = estado_hacia
        pedido.updated_at    = datetime.utcnow()
        uow.pedidos.add(pedido)             # marca el pedido como modificado

        # ── Audit trail: append-only vía repo ─────────────────────────────
        uow.historial.append(HistorialEstadoPedido(
            pedido_id    = pedido.id,
            estado_desde = estado_actual,
            estado_hacia = estado_hacia,
            usuario_id   = usuario_id,
            motivo       = data.motivo,
        ))

        uow.flush()
        uow.refresh(pedido)
        return pedido

    @staticmethod
    def get_pedidos_usuario(uow: UnitOfWork, usuario_id: int) -> list[Pedido]:
        # Antes: uow.session.exec(select(...)). Ahora: el repo.
        return uow.pedidos.get_by_usuario(usuario_id)

    @staticmethod
    def get_todos_pedidos(uow: UnitOfWork, estado: Optional[str] = None) -> list[Pedido]:
        # Antes: query con select() acá. Ahora vive en el repo.
        return uow.pedidos.get_all_active(estado=estado)

    @staticmethod
    def get_pedido(uow: UnitOfWork, pedido_id: int, usuario_id: int, roles: list[str]) -> Pedido:
        pedido = uow.pedidos.get_by_id(pedido_id)
        if not pedido or pedido.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")
        if "CLIENT" in roles and not any(r in ROLES_ADMIN_PEDIDOS for r in roles):
            if pedido.usuario_id != usuario_id:
                raise HTTPException(status_code=403, detail="Acceso denegado.")
        return pedido