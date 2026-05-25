"""
DetallePedido — ítems del pedido.

INMUTABLE desde creación (RN-04):
  - sin updated_at por diseño
  - nombre_snapshot y precio_snapshot copiados desde Producto al crear
  - personalizacion: lista de IDs de ingredientes removidos (es_removible=True)
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON

if TYPE_CHECKING:
    from .pedido import Pedido


class DetallePedido(SQLModel, table=True):
    __tablename__ = "detalles_pedido"

    pedido_id:   int = Field(foreign_key="pedidos.id",   primary_key=True)
    producto_id: int = Field(foreign_key="productos.id", primary_key=True)

    cantidad: int = Field(ge=1)

    # Snapshots inmutables
    nombre_snapshot:   str     = Field(max_length=200)
    precio_snapshot:   Decimal = Field(decimal_places=2, max_digits=10)
    subtotal_snap:     Decimal = Field(decimal_places=2, max_digits=10)

    # IDs de ingredientes removidos — ej: [3, 7]
    personalizacion: Optional[List[int]] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    created_at: datetime = Field(default_factory=datetime.utcnow)

    pedido: Optional["Pedido"] = Relationship(back_populates="detalles")
