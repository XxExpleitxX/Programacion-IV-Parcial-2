"""
Router de DireccionEntrega.

CAMBIOS (devolución del profe):
  - Ya NO se llama uow.commit() (commit automático del UoW).
  - Ya NO se usa uow.session directamente: todo pasa por uow.direcciones.

Endpoints:
  POST   /direcciones/               → crear dirección
  GET    /direcciones/               → listar mis direcciones
  PATCH  /direcciones/{id}/principal → marcar como principal
  DELETE /direcciones/{id}           → soft delete
"""

from datetime import datetime
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.core.security import require_authenticated
from app.modules.auth.usuario import Usuario
from app.modules.direcciones.direccion_entrega import DireccionEntrega
from app.schemas.pago_schema import DireccionCreate, DireccionRead
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/direcciones", tags=["Direcciones"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]


@router.post("/", response_model=DireccionRead, status_code=status.HTTP_201_CREATED)
def crear_direccion(
    data: DireccionCreate,
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    direccion = DireccionEntrega(**data.model_dump(), usuario_id=usuario.id)
    uow.direcciones.add(direccion)      # antes: uow.session.add(...)
    uow.flush()                          # obtiene el id (sin commitear)
    uow.refresh(direccion)
    return direccion                     # commit automático al cerrar el request


@router.get("/", response_model=List[DireccionRead])
def listar_direcciones(
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    return uow.direcciones.get_by_usuario(usuario.id)   # query en el repo, no acá


@router.put("/{direccion_id}", response_model=DireccionRead)
def editar_direccion(
    direccion_id: Annotated[int, Path(ge=1)],
    data: DireccionCreate,
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    """Edita una dirección propia."""
    direccion = uow.direcciones.get_propia(direccion_id, usuario.id)
    if not direccion:
        raise HTTPException(status_code=404, detail="Dirección no encontrada.")
    for campo, valor in data.model_dump().items():
        setattr(direccion, campo, valor)
    uow.direcciones.add(direccion)
    uow.flush()
    uow.refresh(direccion)
    return direccion


@router.patch("/{direccion_id}/principal", response_model=DireccionRead)
def marcar_principal(
    direccion_id: Annotated[int, Path(ge=1)],
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    """Marca una dirección como principal y desmarca las demás."""
    direccion = uow.direcciones.get_propia(direccion_id, usuario.id)
    if not direccion:
        raise HTTPException(status_code=404, detail="Dirección no encontrada.")

    # Desmarcar todas las del usuario y marcar la elegida
    for d in uow.direcciones.get_by_usuario(usuario.id):
        d.es_principal = False
        uow.direcciones.add(d)

    direccion.es_principal = True
    uow.direcciones.add(direccion)
    uow.flush()
    uow.refresh(direccion)
    return direccion


@router.delete("/{direccion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_direccion(
    direccion_id: Annotated[int, Path(ge=1)],
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    """Soft delete — marca deleted_at."""
    direccion = uow.direcciones.get_propia(direccion_id, usuario.id)
    if not direccion:
        raise HTTPException(status_code=404, detail="Dirección no encontrada.")
    direccion.deleted_at = datetime.utcnow()
    uow.direcciones.add(direccion)       # commit automático al cerrar el request