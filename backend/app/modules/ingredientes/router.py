
from typing import Annotated, Optional, List
from fastapi import APIRouter, Depends, Query, Path, status
from app.core.security import require_admin, require_admin_or_editor, require_authenticated
from app.schemas import IngredienteCreate, IngredienteUpdate, IngredienteRead
from app.modules.ingredientes import service as ingrediente_service
from app.modules.auth.usuario import Usuario
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/ingredientes", tags=["Ingredientes"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]


# ─── Lectura ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[IngredienteRead])
def listar_ingredientes(
    uow: UoWDep,
    user: Usuario = Depends(require_authenticated),
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
    nombre: Annotated[Optional[str], Query()] = None,
):
    return ingrediente_service.get_all(uow, offset, limit, nombre)


@router.get("/{ingrediente_id}", response_model=IngredienteRead)
def obtener_ingrediente(
    uow: UoWDep,
    ingrediente_id: Annotated[int, Path(ge=1)],
    user: Usuario = Depends(require_authenticated),
):
    return ingrediente_service.get_by_id(uow, ingrediente_id)


# ─── Escritura (con commit en el router) ──────────────────────────────────────

@router.post("/", response_model=IngredienteRead, status_code=status.HTTP_201_CREATED)
def crear_ingrediente(
    uow: UoWDep,
    data: IngredienteCreate,
    user: Usuario = Depends(require_admin_or_editor),
):
    resultado = ingrediente_service.create(uow, data)
    return resultado


@router.put("/{ingrediente_id}", response_model=IngredienteRead)
def actualizar_ingrediente(
    uow: UoWDep,
    ingrediente_id: Annotated[int, Path(ge=1)],
    data: IngredienteUpdate,
    user: Usuario = Depends(require_admin_or_editor),
):
    resultado = ingrediente_service.update(uow, ingrediente_id, data)
    return resultado


@router.delete("/{ingrediente_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_ingrediente(
    uow: UoWDep,
    ingrediente_id: Annotated[int, Path(ge=1)],
    user: Usuario = Depends(require_admin),
):
    ingrediente_service.delete(uow, ingrediente_id)