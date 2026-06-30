
from typing import List, Optional
from sqlmodel import Session, select
from app.modules.pedidos.catalogs import FormaPago, EstadoPedido
from app.modules.unidades.unidad_medida import UnidadMedida
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