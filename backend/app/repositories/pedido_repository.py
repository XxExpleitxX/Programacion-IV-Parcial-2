"""
Repositorios de Pedido — TODA consulta a la BD vive acá (no en el service).

Devolución del profe:
  - "Consultas a la db deben estar en los repositorios, no en el service."
  - "Crear HistorialEstadoPedidoRepository y usarlo en vez de usar la session."
"""

from typing import Optional, List
from sqlmodel import Session, select

from app.models.pedido import Pedido
from app.models.detalle_pedido import DetallePedido
from app.models.historial_estado_pedido import HistorialEstadoPedido
from app.repositories.base_repository import BaseRepository


class PedidoRepository(BaseRepository[Pedido]):
    def __init__(self, session: Session):
        super().__init__(session, Pedido)

    def get_by_usuario(self, usuario_id: int) -> List[Pedido]:
        """Pedidos de un cliente (sin los borrados), más nuevos primero."""
        return self.session.exec(
            select(Pedido)
            .where(Pedido.usuario_id == usuario_id)
            .where(Pedido.deleted_at == None)            # noqa: E711
            .order_by(Pedido.created_at.desc())
        ).all()

    def get_all_active(self, estado: Optional[str] = None) -> List[Pedido]:
        """
        Todos los pedidos activos (ADMIN/PEDIDOS), con filtro opcional por estado.
        ANTES esta query estaba en el service → ahora vive donde corresponde: el repo.
        """
        query = select(Pedido).where(Pedido.deleted_at == None)   # noqa: E711
        if estado:
            query = query.where(Pedido.estado_codigo == estado.upper())
        return self.session.exec(query.order_by(Pedido.created_at.desc())).all()

    def get_with_detalles(self, pedido_id: int) -> Optional[Pedido]:
        pedido = self.session.get(Pedido, pedido_id)
        if pedido:
            _ = pedido.detalles   # fuerza la carga de la relación
        return pedido


class DetallePedidoRepository(BaseRepository[DetallePedido]):
    def __init__(self, session: Session):
        super().__init__(session, DetallePedido)

    def bulk_create(self, detalles: List[DetallePedido]) -> None:
        """Agrega varios detalles de una (el commit lo hace el UoW)."""
        for d in detalles:
            self.session.add(d)

    def get_by_pedido(self, pedido_id: int) -> List[DetallePedido]:
        return self.session.exec(
            select(DetallePedido).where(DetallePedido.pedido_id == pedido_id)
        ).all()


class HistorialEstadoPedidoRepository(BaseRepository[HistorialEstadoPedido]):
    """
    Audit Trail — SOLO permite INSERT (append-only). Nunca update ni delete.
    El service usa uow.historial.append(...) en lugar de tocar la session.
    """
    def __init__(self, session: Session):
        super().__init__(session, HistorialEstadoPedido)

    def append(self, registro: HistorialEstadoPedido) -> HistorialEstadoPedido:
        self.session.add(registro)
        return registro

    def get_by_pedido(self, pedido_id: int) -> List[HistorialEstadoPedido]:
        return self.session.exec(
            select(HistorialEstadoPedido)
            .where(HistorialEstadoPedido.pedido_id == pedido_id)
            .order_by(HistorialEstadoPedido.created_at.asc())
        ).all()