from typing import Optional, List
from sqlmodel import Session, select

from app.modules.pagos.pago import Pago
from app.repositories.base_repository import BaseRepository


class PagoRepository(BaseRepository[Pago]):
    def __init__(self, session: Session):
        super().__init__(session, Pago)

    def create(self, pago: Pago) -> Pago:
        self.session.add(pago)
        return pago

    def get_by_pedido(self, pedido_id: int) -> List[Pago]:
        return self.session.exec(
            select(Pago).where(Pago.pedido_id == pedido_id)
        ).all()

    def get_by_external_reference(self, external_reference: str) -> Optional[Pago]:
        return self.session.exec(
            select(Pago).where(Pago.external_reference == external_reference)
        ).first()

    def get_by_mp_payment_id(self, mp_payment_id: int) -> Optional[Pago]:
        return self.session.exec(
            select(Pago).where(Pago.mp_payment_id == mp_payment_id)
        ).first()