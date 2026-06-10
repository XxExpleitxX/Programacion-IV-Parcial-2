"""
FormaPago y EstadoPedido — catálogos con PK semántica (string).
Se cargan via seed, nunca por el usuario.
"""

from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .pedido import Pedido
    from .historial_estado_pedido import HistorialEstadoPedido


class FormaPago(SQLModel, table=True):
    __tablename__ = "formas_pago"

    # PK semántica: "MERCADOPAGO" | "EFECTIVO" | "TRANSFERENCIA"
    codigo:      str  = Field(primary_key=True, max_length=20)
    descripcion: str  = Field(max_length=80)
    habilitado:  bool = Field(default=True)

    pedidos: List["Pedido"] = Relationship(back_populates="forma_pago")


class EstadoPedido(SQLModel, table=True):
    __tablename__ = "estados_pedido"

    # PK semántica: "PENDIENTE" | "CONFIRMADO" | "EN_PREP" | "ENTREGADO" | "CANCELADO"
    codigo:      str  = Field(primary_key=True, max_length=20)
    descripcion: str  = Field(max_length=80)
    orden:       int  = Field()           # para ordenar en UI
    es_terminal: bool = Field(default=False)  # si True → no hay más transiciones

    pedidos: List["Pedido"] = Relationship(back_populates="estado")

    # Historial — estado origen y destino
    historial_desde: List["HistorialEstadoPedido"] = Relationship(
        back_populates="estado_desde_rel",
        sa_relationship_kwargs={"foreign_keys": "[HistorialEstadoPedido.estado_desde]"},
    )
    historial_hacia: List["HistorialEstadoPedido"] = Relationship(
        back_populates="estado_hacia_rel",
        sa_relationship_kwargs={"foreign_keys": "[HistorialEstadoPedido.estado_hacia]"},
    )