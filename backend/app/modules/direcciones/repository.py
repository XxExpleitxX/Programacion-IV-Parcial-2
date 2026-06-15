"""
DireccionRepository — consultas de DireccionEntrega.

Para que el router de direcciones NO use uow.session directamente
(misma idea que pidió el profe para los pedidos).
"""

from typing import List, Optional
from sqlmodel import Session, select

from app.modules.direcciones.direccion_entrega import DireccionEntrega
from app.repositories.base_repository import BaseRepository


class DireccionRepository(BaseRepository[DireccionEntrega]):
    def __init__(self, session: Session):
        super().__init__(session, DireccionEntrega)

    def get_by_usuario(self, usuario_id: int) -> List[DireccionEntrega]:
        """Direcciones activas (no borradas) de un usuario."""
        return self.session.exec(
            select(DireccionEntrega)
            .where(DireccionEntrega.usuario_id == usuario_id)
            .where(DireccionEntrega.deleted_at == None)   # noqa: E711
        ).all()

    def get_propia(self, direccion_id: int, usuario_id: int) -> Optional[DireccionEntrega]:
        """Devuelve la dirección solo si es del usuario y no está borrada."""
        direccion = self.session.get(DireccionEntrega, direccion_id)
        if not direccion or direccion.usuario_id != usuario_id or direccion.deleted_at is not None:
            return None
        return direccion