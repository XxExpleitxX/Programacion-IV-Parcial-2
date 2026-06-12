"""
Repositorios de catálogos (FormaPago, EstadoPedido).

Existen para que el service NO use uow.session.get(FormaPago, ...) directamente,
sino uow.formas_pago.get_by_id(...). (Devolución del profe: nada de session en el service.)

Nota: estos modelos tienen PK semántica de tipo string (ej. "EFECTIVO", "PENDIENTE"),
y get_by_id de BaseRepository funciona igual con PK string.
"""

from typing import List, Optional
from sqlmodel import Session, select
from app.models.catalogs import FormaPago, EstadoPedido
from app.models.unidad_medida import UnidadMedida
from app.repositories.base_repository import BaseRepository


class FormaPagoRepository(BaseRepository[FormaPago]):
    def __init__(self, session: Session):
        super().__init__(session, FormaPago)


class EstadoPedidoRepository(BaseRepository[EstadoPedido]):
    def __init__(self, session: Session):
        super().__init__(session, EstadoPedido)


class UnidadMedidaRepository(BaseRepository[UnidadMedida]):
    def __init__(self, session: Session):
        super().__init__(session, UnidadMedida)

    def list_all(self) -> List[UnidadMedida]:
        return self.session.exec(select(UnidadMedida)).all()

    def get_by_simbolo(self, simbolo: str) -> Optional[UnidadMedida]:
        return self.session.exec(
            select(UnidadMedida).where(UnidadMedida.simbolo == simbolo)
        ).first()