"""
Pago — registro de pago MercadoPago.

idempotency_key: UUID generado POR EL BACKEND, enviado a MP
en header X-Idempotency-Key para evitar cobros duplicados.

mp_payment_id: ID que devuelve MP tras procesar el pago (NULL hasta webhook).
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import BigInteger, Column
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .pedido import Pedido


class Pago(SQLModel, table=True):
    __tablename__ = "pagos"

    id: Optional[int] = Field(default=None, primary_key=True)

    pedido_id:          int           = Field(foreign_key="pedidos.id")
    # BIGINT: los payment_id de MercadoPago superan el rango de INT (ej: 163485048043)
    mp_payment_id:      Optional[int] = Field(
        default=None,
        sa_column=Column(BigInteger, unique=True, nullable=True),
    )
    mp_status:          str           = Field(max_length=30)           # approved | pending | rejected | ...
    mp_status_detail:   Optional[str] = Field(default=None, max_length=100)
    external_reference: str           = Field(max_length=100, unique=True)  # nuestro ID de referencia
    idempotency_key:    str           = Field(max_length=100, unique=True)  # UUID generado por backend
    transaction_amount: Decimal       = Field(decimal_places=2, max_digits=10)
    payment_method_id:  Optional[str] = Field(default=None, max_length=50)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    pedido: Optional["Pedido"] = Relationship(back_populates="pagos")
