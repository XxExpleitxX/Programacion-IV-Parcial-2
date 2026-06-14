from typing import Optional, List
from pydantic import BaseModel, field_validator


# ─────────────────────────────────────────────
# CATEGORIA
# ─────────────────────────────────────────────
class CategoriaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    parent_id: Optional[int] = None

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    parent_id: Optional[int] = None


class CategoriaRead(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    parent_id: Optional[int] = None
    imagen_url: Optional[str] = None

    model_config = {"from_attributes": True}


class CategoriaConHijosRead(CategoriaRead):
    subcategorias: List["CategoriaConHijosRead"] = []


CategoriaConHijosRead.model_rebuild()


# ─────────────────────────────────────────────
# INGREDIENTE
# ─────────────────────────────────────────────
class IngredienteCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    es_alergeno: bool = False
    precio_unitario: float = 0.0
    stock_disponible: int = 0.0
    unidad_medida_id: Optional[int] = None

    @field_validator("nombre")
    @classmethod
    def no_vacio(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El campo no puede estar vacío")
        return v.strip()


class IngredienteUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    es_alergeno: Optional[bool] = None
    precio_unitario: Optional[float] = None
    stock_disponible: Optional[int] = None
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
class ProductoCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    precio_base: float
    disponible: bool = True
    stock_cantidad: int = 0
    unidad_venta_id: Optional[int] = None
    categoria_ids: List[int] = []
    es_manufacturado: bool = False
    ingrediente_ids: List[int] = []
    imagenes_url: List[str] = []          # URLs de Cloudinary

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()

    @field_validator("precio_base")
    @classmethod
    def precio_positivo(cls, v: float) -> float:
        if v < 0:
            raise ValueError("El precio no puede ser negativo")
        return v


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio_base: Optional[float] = None
    disponible: Optional[bool] = None
    stock_cantidad: Optional[int] = None
    unidad_venta_id: Optional[int] = None
    categoria_ids: Optional[List[int]] = None
    es_manufacturado: Optional[bool] = None
    ingrediente_ids: Optional[List[int]] = None
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
