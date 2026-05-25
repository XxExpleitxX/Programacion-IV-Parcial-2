"""
PedidoService — FSM de estados + lógica de negocio.

FSM:
  PENDIENTE  → CONFIRMADO | CANCELADO  (CLIENTE puede cancelar)
  CONFIRMADO → EN_PREP    | CANCELADO  (CLIENTE puede cancelar)
  EN_PREP    → EN_CAMINO  | CANCELADO  (solo ADMIN/PEDIDOS pueden cancelar)
  EN_CAMINO  → ENTREGADO
  ENTREGADO  → (terminal)
  CANCELADO  → (terminal)
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlmodel import select

from app.models.pedido import Pedido
from app.models.detalle_pedido import DetallePedido
from app.models.historial_estado_pedido import HistorialEstadoPedido
from app.models.producto import Producto
from app.models.catalogs import FormaPago
from app.schemas.pago_schema import PedidoCreate, AvanzarEstadoRequest
from app.repositories.pedido_repository import PedidoRepository, HistorialRepository
from app.unit_of_work import UnitOfWork


FSM: dict[str, list[str]] = {
    "PENDIENTE":  ["CONFIRMADO", "CANCELADO"],
    "CONFIRMADO": ["EN_PREP",    "CANCELADO"],
    "EN_PREP":    ["EN_CAMINO",  "CANCELADO"],
    "EN_CAMINO":  ["ENTREGADO"],
    "ENTREGADO":  [],
    "CANCELADO":  [],
}

# CLIENT solo puede cancelar desde PENDIENTE y CONFIRMADO
ESTADOS_CANCELABLE_POR_CLIENT = {"PENDIENTE", "CONFIRMADO"}
ROLES_ADMIN_PEDIDOS = {"ADMIN", "PEDIDOS"}


def _validar_transicion(estado_actual: str, estado_hacia: str, roles: list[str]) -> None:
    permitidos = FSM.get(estado_actual, [])
    if estado_hacia not in permitidos:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Transición inválida: {estado_actual} → {estado_hacia}. Permitidas: {permitidos}",
        )
    # Cancelar desde EN_PREP solo ADMIN/PEDIDOS
    if estado_actual == "EN_PREP" and estado_hacia == "CANCELADO":
        if not any(r in ROLES_ADMIN_PEDIDOS for r in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo ADMIN o PEDIDOS pueden cancelar desde EN_PREP.",
            )
    # cliente solo puede cancelar, no avanzar otros estados
    if "CLIENT" in roles and not any(r in ROLES_ADMIN_PEDIDOS for r in roles):
        if estado_hacia not in ("CANCELADO",):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Los clientes solo pueden cancelar pedidos.",
            )


class PedidoService:

    @staticmethod
    def crear_pedido(uow: UnitOfWork, usuario_id: int, data: PedidoCreate) -> Pedido:
        forma = uow.session.get(FormaPago, data.forma_pago_codigo)
        if not forma or not forma.habilitado:
            raise HTTPException(status_code=422, detail="Forma de pago no válida.")

        detalles: list[DetallePedido] = []
        subtotal = Decimal("0.00")

        for item in data.items:
            producto = uow.session.get(Producto, item.producto_id)
            if not producto or producto.deleted_at is not None:
                raise HTTPException(status_code=422, detail=f"Producto {item.producto_id} no encontrado.")
            if not producto.disponible:
                raise HTTPException(status_code=422, detail=f"Producto '{producto.nombre}' no disponible.")

            precio = Decimal(str(producto.precio_base))
            sub = precio * item.cantidad
            subtotal += sub

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
        uow.session.add(pedido)
        uow.flush()

        for d in detalles:
            d.pedido_id = pedido.id
            uow.session.add(d)

        uow.session.add(HistorialEstadoPedido(
            pedido_id    = pedido.id,
            estado_desde = None,
            estado_hacia = "PENDIENTE",
            usuario_id   = usuario_id,
            motivo       = "Pedido creado",
        ))

        uow.flush()
        uow.refresh(pedido)
        return pedido

    @staticmethod
    def avanzar_estado(
        uow: UnitOfWork,
        pedido_id: int,
        usuario_id: int,
        roles: list[str],
        data: AvanzarEstadoRequest,
    ) -> Pedido:
        pedido = uow.session.get(Pedido, pedido_id)
        if not pedido or pedido.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")

        estado_actual = pedido.estado_codigo
        estado_hacia  = data.estado_hacia.upper()

        if estado_hacia == "CANCELADO" and not data.motivo:
            raise HTTPException(status_code=422, detail="motivo es obligatorio al cancelar.")

        # cliente solo puede cancelar sus propios pedidos desde PENDIENTE o CONFIRMADO
        if "CLIENT" in roles and not any(r in ROLES_ADMIN_PEDIDOS for r in roles):
            if pedido.usuario_id != usuario_id:
                raise HTTPException(status_code=403, detail="Acceso denegado.")
            if estado_actual not in ESTADOS_CANCELABLE_POR_CLIENT:
                raise HTTPException(
                    status_code=403,
                    detail=f"Solo podés cancelar desde PENDIENTE o CONFIRMADO.",
                )

        _validar_transicion(estado_actual, estado_hacia, roles)

        pedido.estado_codigo = estado_hacia
        pedido.updated_at    = datetime.utcnow()

        uow.session.add(HistorialEstadoPedido(
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
        return uow.session.exec(
            select(Pedido)
            .where(Pedido.usuario_id == usuario_id)
            .where(Pedido.deleted_at == None)
            .order_by(Pedido.created_at.desc())
        ).all()

    @staticmethod
    def get_todos_pedidos(uow: UnitOfWork, estado: Optional[str] = None) -> list[Pedido]:
        """ADMIN y PEDIDOS ven todos los pedidos, con filtro opcional por estado."""
        query = select(Pedido).where(Pedido.deleted_at == None)
        if estado:
            query = query.where(Pedido.estado_codigo == estado.upper())
        return uow.session.exec(query.order_by(Pedido.created_at.desc())).all()

    @staticmethod
    def get_pedido(uow: UnitOfWork, pedido_id: int, usuario_id: int, roles: list[str]) -> Pedido:
        pedido = uow.session.get(Pedido, pedido_id)
        if not pedido or pedido.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")
        if "CLIENT" in roles and not any(r in ROLES_ADMIN_PEDIDOS for r in roles):
            if pedido.usuario_id != usuario_id:
                raise HTTPException(status_code=403, detail="Acceso denegado.")
        return pedido