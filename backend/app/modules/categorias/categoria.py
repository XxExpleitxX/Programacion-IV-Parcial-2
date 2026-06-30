
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .producto_categoria import ProductoCategoria


class Categoria(SQLModel, table=True):
    __tablename__ = "categorias"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Auto-referencia: categoría padre (NULL = raíz)
    parent_id: Optional[int] = Field(
        default=None, foreign_key="categorias.id", nullable=True
    )

    nombre:      str           = Field(max_length=100, unique=True)
    descripcion: Optional[str] = Field(default=None)
    imagen_url:  Optional[str] = Field(default=None)

    # Identidad visual de la sección del menú
    icono: Optional[str] = Field(default=None, max_length=16)   # emoji, ej: 🍕
    color: Optional[str] = Field(default=None, max_length=24)   # color del badge, ej: #8b5cf6

    # Audit
    created_at: datetime           = Field(default_factory=datetime.utcnow)
    updated_at: datetime           = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)

    # Relaciones
    producto_categorias: List["ProductoCategoria"] = Relationship(
        back_populates="categoria"
    )
