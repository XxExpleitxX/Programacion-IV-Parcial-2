
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .producto import Producto
    from .categoria import Categoria


class ProductoCategoria(SQLModel, table=True):
    __tablename__ = "producto_categorias"

    producto_id:  Optional[int] = Field(default=None, foreign_key="productos.id",  primary_key=True)
    categoria_id: Optional[int] = Field(default=None, foreign_key="categorias.id", primary_key=True)

    es_principal: bool     = Field(default=False)
    created_at:   datetime = Field(default_factory=datetime.utcnow)

    producto:  Optional["Producto"]  = Relationship(back_populates="producto_categorias")
    categoria: Optional["Categoria"] = Relationship(back_populates="producto_categorias")
