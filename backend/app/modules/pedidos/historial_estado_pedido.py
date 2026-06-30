
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .pedido import Pedido
    from .catalogs import EstadoPedido


class HistorialEstadoPedido(SQLModel, table=True):
    __tablename__ = "historial_estados_pedido"

    id: Optional[int] = Field(default=None, primary_key=True)

    pedido_id:    int           = Field(foreign_key="pedidos.id")
    estado_desde: Optional[str] = Field(default=None, foreign_key="estados_pedido.codigo", nullable=True)
    estado_hacia: str           = Field(foreign_key="estados_pedido.codigo", max_length=20)
    usuario_id:   Optional[int] = Field(default=None, foreign_key="usuarios.id", nullable=True)
    motivo:       Optional[str] = Field(default=None)

    # append-only: solo created_at, sin updated_at
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relaciones
    pedido: Optional["Pedido"] = Relationship(back_populates="historial")
    estado_desde_rel: Optional["EstadoPedido"] = Relationship(
        back_populates="historial_desde",
        sa_relationship_kwargs={"foreign_keys": "[HistorialEstadoPedido.estado_desde]"},
    )
    estado_hacia_rel: Optional["EstadoPedido"] = Relationship(
        back_populates="historial_hacia",
        sa_relationship_kwargs={"foreign_keys": "[HistorialEstadoPedido.estado_hacia]"},
    )
