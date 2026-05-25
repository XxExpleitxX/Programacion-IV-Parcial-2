"""
PedidoRepository — operaciones de BD para Pedido, DetallePedido e Historial.
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
        return self.session.exec(
            select(Pedido)
            .where(Pedido.usuario_id == usuario_id)
            .where(Pedido.deleted_at == None)
            .order_by(Pedido.created_at.desc())
        ).all()

    def get_with_detalles(self, pedido_id: int) -> Optional[Pedido]:
        pedido = self.session.get(Pedido, pedido_id)
        if pedido:
            # Carga explícita de detalles
            _ = pedido.detalles
        return pedido


class DetallePedidoRepository:
    def __init__(self, session: Session):
        self.session = session

    def bulk_create(self, detalles: List[DetallePedido]) -> None:
        for d in detalles:
            self.session.add(d)

    def get_by_pedido(self, pedido_id: int) -> List[DetallePedido]:
        return self.session.exec(
            select(DetallePedido).where(DetallePedido.pedido_id == pedido_id)
        ).all()


class HistorialRepository:
    def __init__(self, session: Session):
        self.session = session

    def append(self, registro: HistorialEstadoPedido) -> HistorialEstadoPedido:
        """SOLO INSERT — nunca update ni delete (RN-03)."""
        self.session.add(registro)
        return registro

    def get_by_pedido(self, pedido_id: int) -> List[HistorialEstadoPedido]:
        return self.session.exec(
            select(HistorialEstadoPedido)
            .where(HistorialEstadoPedido.pedido_id == pedido_id)
            .order_by(HistorialEstadoPedido.created_at.asc())
        ).all()
