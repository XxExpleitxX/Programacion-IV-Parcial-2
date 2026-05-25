"""
Pedido — cabecera del pedido.

Campos monetarios son SNAPSHOT (inmutables desde creación):
  subtotal, descuento, costo_envio, total.

estado_codigo se actualiza atómicamente junto con
un INSERT en HistorialEstadoPedido (ver PedidoService.avanzar_estado).
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .catalogs import FormaPago, EstadoPedido
    from .direccion_entrega import DireccionEntrega
    from .detalle_pedido import DetallePedido
    from .historial_estado_pedido import HistorialEstadoPedido
    from .pago import Pago


class Pedido(SQLModel, table=True):
    __tablename__ = "pedidos"

    id: Optional[int] = Field(default=None, primary_key=True)

    usuario_id:        int           = Field(foreign_key="usuarios.id")
    direccion_id:      Optional[int] = Field(default=None, foreign_key="direcciones_entrega.id", nullable=True)
    estado_codigo:     str           = Field(foreign_key="estados_pedido.codigo", max_length=20)
    forma_pago_codigo: str           = Field(foreign_key="formas_pago.codigo",    max_length=20)

    # Snapshot monetario — inmutable desde creación
    subtotal:    Decimal = Field(decimal_places=2, max_digits=10)
    descuento:   Decimal = Field(default=Decimal("0.00"), decimal_places=2, max_digits=10)
    costo_envio: Decimal = Field(default=Decimal("50.00"), decimal_places=2, max_digits=10)
    total:       Decimal = Field(decimal_places=2, max_digits=10)

    notas: Optional[str] = Field(default=None)

    created_at: datetime           = Field(default_factory=datetime.utcnow)
    updated_at: datetime           = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)

    # Relaciones
    estado:    Optional["EstadoPedido"]     = Relationship(back_populates="pedidos")
    forma_pago: Optional["FormaPago"]       = Relationship(back_populates="pedidos")
    direccion: Optional["DireccionEntrega"] = Relationship(back_populates="pedidos")
    detalles:  List["DetallePedido"]        = Relationship(back_populates="pedido")
    historial: List["HistorialEstadoPedido"] = Relationship(back_populates="pedido")
    pagos:     List["Pago"]                 = Relationship(back_populates="pedido")
