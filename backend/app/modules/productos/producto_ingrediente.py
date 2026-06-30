
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .producto import Producto
    from .ingrediente import Ingrediente
    from .unidad_medida import UnidadMedida


class ProductoIngrediente(SQLModel, table=True):
    __tablename__ = "producto_ingredientes"

    producto_id:    Optional[int] = Field(default=None, foreign_key="productos.id",    primary_key=True)
    ingrediente_id: Optional[int] = Field(default=None, foreign_key="ingredientes.id", primary_key=True)

    cantidad:        float = Field(gt=0)
    unidad_medida_id: int  = Field(foreign_key="unidades_medida.id")
    es_removible:    bool  = Field(default=False)

    producto:      Optional["Producto"]     = Relationship(back_populates="producto_ingredientes")
    ingrediente:   Optional["Ingrediente"]  = Relationship(back_populates="producto_ingredientes")
    unidad_medida: Optional["UnidadMedida"] = Relationship(back_populates="producto_ingredientes")
