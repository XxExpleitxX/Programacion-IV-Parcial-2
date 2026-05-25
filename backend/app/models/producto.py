from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON

if TYPE_CHECKING:
    from .unidad_medida import UnidadMedida
    from .producto_categoria import ProductoCategoria
    from .producto_ingrediente import ProductoIngrediente


class Producto(SQLModel, table=True):
    __tablename__ = "productos"

    id: Optional[int] = Field(default=None, primary_key=True)

    unidad_venta_id: Optional[int] = Field(
        default=None, foreign_key="unidades_medida.id", nullable=True
    )

    nombre:          str                 = Field(max_length=150)
    descripcion:     Optional[str]       = Field(default=None)
    precio_base:     float               = Field(ge=0)
    imagenes_url:    Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    stock_cantidad:  int                 = Field(default=0, ge=0)
    disponible:      bool                = Field(default=True)
    es_manufacturado: bool               = Field(default=False)  # ← nuevo

    created_at: datetime           = Field(default_factory=datetime.utcnow)
    updated_at: datetime           = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)

    unidad_venta:          Optional["UnidadMedida"]     = Relationship(back_populates="productos")
    producto_categorias:   List["ProductoCategoria"]    = Relationship(back_populates="producto")
    producto_ingredientes: List["ProductoIngrediente"]  = Relationship(back_populates="producto")