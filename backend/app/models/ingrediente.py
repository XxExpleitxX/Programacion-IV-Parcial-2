"""
Ingrediente — tabla global (no duplicado por producto).
es_alergeno = true → badge UI en ProductoDetail y ProductCard.
"""

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

    # Audit
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    producto_ingredientes: List["ProductoIngrediente"] = Relationship(
        back_populates="ingrediente"
    )
