
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .producto import Producto
    from .producto_ingrediente import ProductoIngrediente


class UnidadMedida(SQLModel, table=True):
    __tablename__ = "unidades_medida"

    id: Optional[int] = Field(default=None, primary_key=True)
    nombre:  str = Field(max_length=50, unique=True)   # "Kilogramo"
    simbolo: str = Field(max_length=10, unique=True)   # "kg"
    tipo:    str = Field(max_length=20)                # "masa" | "volumen" | "unidad"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Productos que se venden en esta unidad
    productos: List["Producto"] = Relationship(back_populates="unidad_venta")

    # Ingredientes medidos en esta unidad dentro de recetas
    producto_ingredientes: List["ProductoIngrediente"] = Relationship(
        back_populates="unidad_medida"
    )
