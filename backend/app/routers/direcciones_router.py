"""
Router de DireccionEntrega.

Endpoints:
  POST   /direcciones/              → crear dirección
  GET    /direcciones/              → listar mis direcciones
  PATCH  /direcciones/{id}/principal → marcar como principal
  DELETE /direcciones/{id}          → soft delete
"""

from datetime import datetime
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlmodel import select

from app.core.security import require_authenticated
from app.models.usuarios.usuario import Usuario
from app.models.direccion_entrega import DireccionEntrega
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
    uow.session.add(direccion)
    uow.commit()
    uow.refresh(direccion)
    return direccion


@router.get("/", response_model=List[DireccionRead])
def listar_direcciones(
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    return uow.session.exec(
        select(DireccionEntrega)
        .where(DireccionEntrega.usuario_id == usuario.id)
        .where(DireccionEntrega.deleted_at == None)
    ).all()


@router.patch("/{direccion_id}/principal", response_model=DireccionRead)
def marcar_principal(
    direccion_id: Annotated[int, Path(ge=1)],
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    """Marca una dirección como principal y desmarca las demás."""
    direccion = uow.session.get(DireccionEntrega, direccion_id)
    if not direccion or direccion.usuario_id != usuario.id or direccion.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Dirección no encontrada.")

    # Desmarcar todas las del usuario
    todas = uow.session.exec(
        select(DireccionEntrega)
        .where(DireccionEntrega.usuario_id == usuario.id)
        .where(DireccionEntrega.deleted_at == None)
    ).all()
    for d in todas:
        d.es_principal = False
        uow.session.add(d)

    # Marcar la seleccionada
    direccion.es_principal = True
    uow.session.add(direccion)
    uow.commit()
    uow.refresh(direccion)
    return direccion


@router.delete("/{direccion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_direccion(
    direccion_id: Annotated[int, Path(ge=1)],
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    """Soft delete — marca deleted_at."""
    direccion = uow.session.get(DireccionEntrega, direccion_id)
    if not direccion or direccion.usuario_id != usuario.id or direccion.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Dirección no encontrada.")
    direccion.deleted_at = datetime.utcnow()
    uow.session.add(direccion)
    uow.commit()