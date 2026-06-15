from datetime import datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .pedido import Pedido


class DireccionEntrega(SQLModel, table=True):
    __tablename__ = "direcciones_entrega"

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id")

    alias:          Optional[str]     = Field(default=None, max_length=50)
    linea1:         str               = Field()
    linea2:         Optional[str]     = Field(default=None)
    ciudad:         str               = Field(max_length=100)
    provincia:      Optional[str]     = Field(default=None, max_length=100)
    codigo_postal:  Optional[str]     = Field(default=None, max_length=10)
    latitud:        Optional[Decimal] = Field(default=None, decimal_places=6, max_digits=9)
    longitud:       Optional[Decimal] = Field(default=None, decimal_places=6, max_digits=9)
    es_principal:   bool              = Field(default=False)

    created_at: datetime           = Field(default_factory=datetime.utcnow)
    updated_at: datetime           = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)

    pedidos: List["Pedido"] = Relationship(back_populates="direccion")
