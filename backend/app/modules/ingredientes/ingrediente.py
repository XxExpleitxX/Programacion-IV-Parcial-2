
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .producto_ingrediente import ProductoIngrediente


class Ingrediente(SQLModel, table=True):
    __tablename__ = "ingredientes"

    id:          Optional[int] = Field(default=None, primary_key=True)
    nombre:      str           = Field(max_length=100, unique=True)
    descripcion: Optional[str] = Field(default=None)
    es_alergeno: bool          = Field(default=False)
    precio_unitario: float = Field(default=0.0, ge=0)
    stock_disponible: float = Field(default=0.0, ge=0)
    unidad_medida_id: Optional[int] = Field(default=None, foreign_key="unidades_medida.id", nullable=True)

    # Audit
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    producto_ingredientes: List["ProductoIngrediente"] = Relationship(
        back_populates="ingrediente"
    )
