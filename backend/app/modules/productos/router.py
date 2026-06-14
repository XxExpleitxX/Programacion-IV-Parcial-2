from typing import Annotated, Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, Path, status
from pydantic import BaseModel
from app.core.security import require_admin, require_admin_or_editor, require_authenticated
from app.schemas import ProductoCreate, ProductoUpdate, ProductoRead
from app.schemas.pagination import Paginated
from app.modules.productos import service as producto_service
from app.models import Usuario
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/productos", tags=["Productos"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]


class DisponibilidadUpdate(BaseModel):
    disponible: bool


class StockUpdate(BaseModel):
    stock_cantidad: int


# ─── Lectura ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=Paginated[ProductoRead])
def listar_productos(
    uow: UoWDep,
    user: Usuario = Depends(require_authenticated),
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    nombre: Annotated[Optional[str], Query(description="Buscar por nombre")] = None,
    disponible: Annotated[Optional[bool], Query(description="Filtrar por disponibilidad")] = None,
    categoria_id: Annotated[Optional[int], Query(description="Filtrar por categoría")] = None,
    precio_min: Annotated[Optional[Decimal], Query(description="Precio mínimo")] = None,
    precio_max: Annotated[Optional[Decimal], Query(description="Precio máximo")] = None,
):
    return producto_service.get_all(
        uow, page, size, nombre, disponible, categoria_id, precio_min, precio_max
    )


@router.get("/{producto_id}", response_model=ProductoRead)
def obtener_producto(
    uow: UoWDep,
    producto_id: Annotated[int, Path(ge=1)],
    user: Usuario = Depends(require_authenticated),
):
    return producto_service.get_by_id(uow, producto_id)

@router.get("/{producto_id}/precio-sugerido")
def calcular_precio_sugerido(
    uow: UoWDep,
    producto_id: Annotated[int, Path(ge=1)],
    margen: Annotated[float, Query(ge=0, le=1000, description="Margen de ganancia en %")] = 30.0,
    user: Usuario = Depends(require_authenticated),
):
    return producto_service.calcular_precio_sugerido(uow, producto_id, margen)

# ─── Escritura ────────────────────────────────────────────────────────────────

@router.post("/", response_model=ProductoRead, status_code=status.HTTP_201_CREATED)
def crear_producto(
    uow: UoWDep,
    data: ProductoCreate,
    user: Usuario = Depends(require_admin_or_editor),
):
    resultado = producto_service.create(uow, data)
    return resultado


@router.put("/{producto_id}", response_model=ProductoRead)
def actualizar_producto(
    uow: UoWDep,
    producto_id: Annotated[int, Path(ge=1)],
    data: ProductoUpdate,
    user: Usuario = Depends(require_admin_or_editor),
):
    resultado = producto_service.update(uow, producto_id, data)
    return resultado


@router.patch("/{producto_id}/disponibilidad", response_model=ProductoRead)
def actualizar_disponibilidad(
    uow: UoWDep,
    producto_id: Annotated[int, Path(ge=1)],
    data: DisponibilidadUpdate,
    user: Usuario = Depends(require_admin_or_editor),
):
    """Activa o desactiva un producto. Permitido para ADMIN y STOCK."""
    resultado = producto_service.patch_disponibilidad(uow, producto_id, data.disponible)
    return resultado


@router.patch("/{producto_id}/stock", response_model=ProductoRead)
def actualizar_stock(
    uow: UoWDep,
    producto_id: Annotated[int, Path(ge=1)],
    data: StockUpdate,
    user: Usuario = Depends(require_admin_or_editor),
):
    """Actualiza el stock de un producto. Permitido para ADMIN y STOCK."""
    return producto_service.patch_stock(uow, producto_id, data.stock_cantidad)


@router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_producto(
    uow: UoWDep,
    producto_id: Annotated[int, Path(ge=1)],
    user: Usuario = Depends(require_admin),
):
    producto_service.delete(uow, producto_id)