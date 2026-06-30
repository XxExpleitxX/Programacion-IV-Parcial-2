
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel

from app.core.deps import require_role
from app.modules.auth.usuario import Usuario, UsuarioPublic
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/admin", tags=["Admin"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]
AdminDep = Depends(require_role(["ADMIN"]))


class AsignarRolRequest(BaseModel):
    rol_codigo: str


# ── Listar usuarios (paginado + filtro por rol) ───────────────────────────────

@router.get("/usuarios", response_model=List[UsuarioPublic])
def listar_usuarios(
    uow: UoWDep,
    _: Usuario = AdminDep,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    rol: Annotated[Optional[str], Query(description="Filtrar por rol: ADMIN, STOCK, PEDIDOS, CLIENT")] = None,
    disabled: Annotated[Optional[bool], Query(description="Filtrar por estado")] = None,
):
    """Listado paginado de usuarios con filtro por rol y estado. Solo ADMIN."""
    return uow.usuarios.get_all(offset=offset, limit=limit, rol=rol, disabled=disabled)


# ── Detalle de usuario ────────────────────────────────────────────────────────

@router.get("/usuarios/{usuario_id}", response_model=UsuarioPublic)
def obtener_usuario(
    usuario_id: Annotated[int, Path(ge=1)],
    uow: UoWDep,
    _: Usuario = AdminDep,
):
    usuario = uow.usuarios.get_by_id(usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario


# ── Activar / desactivar ──────────────────────────────────────────────────────

@router.post("/usuarios/{usuario_id}/activar", response_model=UsuarioPublic)
def activar_usuario(
    usuario_id: Annotated[int, Path(ge=1)],
    uow: UoWDep,
    _: Usuario = AdminDep,
):
    usuario = uow.usuarios.get_by_id(usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    usuario.disabled = False
    uow.usuarios.add(usuario)
    uow.flush()   # commit lo hace el UoW; flush para que refresh vea el cambio
    uow.refresh(usuario)
    return usuario


@router.post("/usuarios/{usuario_id}/desactivar", response_model=UsuarioPublic)
def desactivar_usuario(
    usuario_id: Annotated[int, Path(ge=1)],
    uow: UoWDep,
    _: Usuario = AdminDep,
):
    usuario = uow.usuarios.get_by_id(usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    usuario.disabled = True
    uow.usuarios.add(usuario)
    uow.flush()   # commit lo hace el UoW; flush para que refresh vea el cambio
    uow.refresh(usuario)
    return usuario


# ── Gestión de roles ──────────────────────────────────────────────────────────

@router.post("/usuarios/{usuario_id}/roles", response_model=UsuarioPublic, status_code=status.HTTP_201_CREATED)
def asignar_rol(
    usuario_id: Annotated[int, Path(ge=1)],
    data: AsignarRolRequest,
    uow: UoWDep,
    _: Usuario = AdminDep,
):
    """Asigna un rol al usuario. Si ya lo tiene, no hace nada."""
    usuario = uow.usuarios.get_by_id(usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    rol = uow.roles.get_by_codigo(data.rol_codigo.upper())
    if not rol:
        raise HTTPException(status_code=404, detail=f"Rol '{data.rol_codigo}' no existe")

    if data.rol_codigo.upper() not in usuario.roles:
        uow.usuarios.assign_role(usuario_id, data.rol_codigo.upper())
        uow.flush()   # commit lo hace el UoW; flush para que refresh vea el cambio
        uow.refresh(usuario)

    return usuario


@router.delete("/usuarios/{usuario_id}/roles/{rol_codigo}", response_model=UsuarioPublic)
def quitar_rol(
    usuario_id: Annotated[int, Path(ge=1)],
    rol_codigo: str,
    uow: UoWDep,
    _: Usuario = AdminDep,
):
    """Quita un rol al usuario."""
    usuario = uow.usuarios.get_by_id(usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    uow.usuarios.remove_role(usuario_id, rol_codigo.upper())
    uow.flush()   # commit lo hace el UoW; flush para que refresh vea el cambio
    uow.refresh(usuario)
    return usuario