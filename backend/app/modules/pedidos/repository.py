
from typing import Optional, List
from sqlmodel import Session, select, func

from app.modules.pedidos.pedido import Pedido
from app.modules.pedidos.detalle_pedido import DetallePedido
from app.repositories.base_repository import BaseRepository


class PedidoRepository(BaseRepository[Pedido]):
    def __init__(self, session: Session):
        super().__init__(session, Pedido)

    def get_by_usuario(self, usuario_id: int, offset: int = 0, limit: int = 20) -> List[Pedido]:
        return self.session.exec(
            select(Pedido)
            .where(Pedido.usuario_id == usuario_id)
            .where(Pedido.deleted_at == None)            # noqa: E711
            .order_by(Pedido.created_at.desc())
            .offset(offset).limit(limit)
        ).all()

    def count_by_usuario(self, usuario_id: int) -> int:
        return self.session.exec(
            select(func.count()).select_from(Pedido)
            .where(Pedido.usuario_id == usuario_id)
            .where(Pedido.deleted_at == None)            # noqa: E711
        ).one()

    def get_all_active(self, estado: Optional[str] = None, offset: int = 0, limit: int = 20) -> List[Pedido]:
        query = select(Pedido).where(Pedido.deleted_at == None)   # noqa: E711
        if estado:
            query = query.where(Pedido.estado_codigo == estado.upper())
        return self.session.exec(
            query.order_by(Pedido.created_at.desc()).offset(offset).limit(limit)
        ).all()

    def count_all_active(self, estado: Optional[str] = None) -> int:
        query = select(func.count()).select_from(Pedido).where(Pedido.deleted_at == None)  # noqa: E711
        if estado:
            query = query.where(Pedido.estado_codigo == estado.upper())
        return self.session.exec(query).one()

    def get_with_detalles(self, pedido_id: int) -> Optional[Pedido]:
        pedido = self.session.get(Pedido, pedido_id)
        if pedido:
            _ = pedido.detalles   # fuerza la carga de la relacion
        return pedido


class DetallePedidoRepository(BaseRepository[DetallePedido]):
    def __init__(self, session: Session):
        super().__init__(session, DetallePedido)

    def bulk_create(self, detalles: List[DetallePedido]) -> None:
        for d in detalles:
            self.session.add(d)

    def get_by_pedido(self, pedido_id: int) -> List[DetallePedido]:
        return self.session.exec(
            select(DetallePedido).where(DetallePedido.pedido_id == pedido_id)
        ).all()