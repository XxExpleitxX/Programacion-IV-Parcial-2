from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


# ─────────────────────────────────────────────
# CATEGORIA
# ─────────────────────────────────────────────
class CategoriaCreate(BaseModel):
    nombre: str = Field(max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    parent_id: Optional[int] = None
    imagen_url: Optional[str] = None       # URL de Cloudinary
    icono: Optional[str] = Field(default=None, max_length=16)   # emoji de la sección
    color: Optional[str] = Field(default=None, max_length=24)   # color del badge

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    parent_id: Optional[int] = None
    imagen_url: Optional[str] = None       # URL de Cloudinary
    icono: Optional[str] = Field(default=None, max_length=16)
    color: Optional[str] = Field(default=None, max_length=24)


class CategoriaRead(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    parent_id: Optional[int] = None
    imagen_url: Optional[str] = None
    icono: Optional[str] = None
    color: Optional[str] = None

    model_config = {"from_attributes": True}


class CategoriaConHijosRead(CategoriaRead):
    subcategorias: List["CategoriaConHijosRead"] = []


CategoriaConHijosRead.model_rebuild()


# ─────────────────────────────────────────────
# INGREDIENTE
# ─────────────────────────────────────────────
class IngredienteCreate(BaseModel):
    nombre: str = Field(max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    es_alergeno: bool = False
    precio_unitario: float = Field(default=0.0, ge=0)
    stock_disponible: int = Field(default=0, ge=0)
    unidad_medida_id: Optional[int] = None

    @field_validator("nombre")
    @classmethod
    def no_vacio(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El campo no puede estar vacío")
        return v.strip()


class IngredienteUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    es_alergeno: Optional[bool] = None
    precio_unitario: Optional[float] = Field(default=None, ge=0)
    stock_disponible: Optional[int] = Field(default=None, ge=0)
    unidad_medida_id: Optional[int] = None


class IngredienteRead(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    es_alergeno: bool
    precio_unitario: float
    stock_disponible: int
    unidad_medida_id: Optional[int] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# PRODUCTO
# ─────────────────────────────────────────────
class IngredienteCantidad(BaseModel):
    ingrediente_id: int
    cantidad: float = 1.0


class IngredienteEnProducto(BaseModel):
    ingrediente_id: int
    nombre: str
    cantidad: float
    unidad: Optional[str] = None
    es_alergeno: bool = False


class ProductoCreate(BaseModel):
    nombre: str = Field(max_length=150)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    precio_base: Decimal
    disponible: bool = True
    stock_cantidad: int = Field(default=0, ge=0)
    unidad_venta_id: Optional[int] = None
    categoria_ids: List[int] = []
    es_manufacturado: bool = False
    ingredientes: List[IngredienteCantidad] = []   # receta: ingrediente + cantidad
    imagenes_url: List[str] = []          # URLs de Cloudinary

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()

    @field_validator("precio_base")
    @classmethod
    def precio_positivo(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("El precio no puede ser negativo")
        return v


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, max_length=150)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    precio_base: Optional[Decimal] = Field(default=None, ge=0)
    disponible: Optional[bool] = None
    stock_cantidad: Optional[int] = Field(default=None, ge=0)
    unidad_venta_id: Optional[int] = None
    categoria_ids: Optional[List[int]] = None
    es_manufacturado: Optional[bool] = None
    ingredientes: Optional[List[IngredienteCantidad]] = None
    imagenes_url: Optional[List[str]] = None


class ProductoRead(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    precio_base: float
    disponible: bool
    stock_cantidad: int
    unidad_venta_id: Optional[int] = None
    categorias: List[CategoriaRead] = []
    es_manufacturado: bool = False
    ingredientes: List[IngredienteEnProducto] = []
    imagenes_url: List[str] = []

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
