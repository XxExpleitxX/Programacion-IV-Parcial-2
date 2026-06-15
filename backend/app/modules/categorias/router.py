from typing import Annotated, Optional, List
from fastapi import APIRouter, Depends, Query, Path, status
from app.core.security import require_admin, require_admin_or_editor, require_authenticated
from app.schemas import CategoriaCreate, CategoriaUpdate, CategoriaRead, CategoriaConHijosRead
from app.modules.categorias import service as categoria_service
from app.modules.auth.usuario import Usuario
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/categorias", tags=["Categorías"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]


# ─── Lectura ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[CategoriaRead])
def listar_categorias(
    uow: UoWDep,
    user: Usuario = Depends(require_authenticated),
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    nombre: Annotated[Optional[str], Query()] = None,
    parent_id: Annotated[Optional[int], Query()] = None,   # ← filtro por parent_id
):
    return categoria_service.get_all(uow, offset, limit, nombre, parent_id)


@router.get("/arbol", response_model=List[CategoriaConHijosRead])
def listar_arbol_categorias(
    uow: UoWDep,
    user: Usuario = Depends(require_authenticated),
):
    return categoria_service.get_arbol(uow)


@router.get("/{categoria_id}", response_model=CategoriaRead)
def obtener_categoria(
    uow: UoWDep,
    categoria_id: Annotated[int, Path(ge=1)],
    user: Usuario = Depends(require_authenticated),
):
    return categoria_service.get_by_id(uow, categoria_id)


@router.get("/{categoria_id}/subcategorias", response_model=List[CategoriaRead])
def listar_subcategorias(
    uow: UoWDep,
    categoria_id: Annotated[int, Path(ge=1)],
    user: Usuario = Depends(require_authenticated),
):
    return categoria_service.get_subcategorias(uow, categoria_id)


# ─── Escritura ────────────────────────────────────────────────────────────────

@router.post("/", response_model=CategoriaRead, status_code=status.HTTP_201_CREATED)
def crear_categoria(
    uow: UoWDep,
    data: CategoriaCreate,
    user: Usuario = Depends(require_admin_or_editor),
):
    resultado = categoria_service.create(uow, data)
    return resultado


@router.put("/{categoria_id}", response_model=CategoriaRead)
def actualizar_categoria(
    uow: UoWDep,
    categoria_id: Annotated[int, Path(ge=1)],
    data: CategoriaUpdate,
    user: Usuario = Depends(require_admin_or_editor),
):
    resultado = categoria_service.update(uow, categoria_id, data)
    return resultado


@router.delete("/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_categoria(
    uow: UoWDep,
    categoria_id: Annotated[int, Path(ge=1)],
    user: Usuario = Depends(require_admin),
):
    categoria_service.delete(uow, categoria_id)