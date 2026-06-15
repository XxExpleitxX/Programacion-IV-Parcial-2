"""
HistorialEstadoPedidoRepository — Audit Trail del pedido.

Append-only: SOLO permite INSERT (nunca UPDATE ni DELETE).
Cada cambio de estado de un pedido inserta una fila inmutable acá.
El service lo usa como: uow.historial.append(registro)
"""

from typing import List
from sqlmodel import Session, select

from app.modules.pedidos.historial_estado_pedido import HistorialEstadoPedido
from app.repositories.base_repository import BaseRepository


class HistorialEstadoPedidoRepository(BaseRepository[HistorialEstadoPedido]):
    def __init__(self, session: Session):
        super().__init__(session, HistorialEstadoPedido)

    def append(self, registro: HistorialEstadoPedido) -> HistorialEstadoPedido:
        """SOLO INSERT — nunca update ni delete (audit trail inmutable)."""
        self.session.add(registro)
        return registro

    def get_by_pedido(self, pedido_id: int) -> List[HistorialEstadoPedido]:
        return self.session.exec(
            select(HistorialEstadoPedido)
            .where(HistorialEstadoPedido.pedido_id == pedido_id)
            .order_by(HistorialEstadoPedido.created_at.asc())
        ).all()