"""
Router de autenticación — sin `with uow:` en los endpoints,
el commit lo maneja get_uow() via __exit__ solo en caso de error (rollback).
Los services de auth hacen commit internamente donde lo necesitan.
"""

from typing import Annotated, List
from fastapi import APIRouter, Depends, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.deps import get_current_active_user, require_role
from app.core.config import settings
from app.models.usuarios.usuario import Usuario, UsuarioCreate, UsuarioPublic, Token, LoginRequest
from app.models.usuarios.usuario_service import (
    registrar_usuario,
    autenticar_usuario,
    set_disabled,
    listar_usuarios,
)
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/auth", tags=["Auth"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]


def _set_auth_cookie(response: Response, token: Token):
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token.access_token,
        httponly=True,
        max_age=settings.COOKIE_MAX_AGE,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )


# ─── Registro ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UsuarioPublic, status_code=status.HTTP_201_CREATED)
def register(data: UsuarioCreate, uow: UoWDep):
    """Registra un usuario nuevo. Rol CLIENT asignado por defecto."""
    resultado = registrar_usuario(uow, data)
    uow.commit()  # ✅ commit explícito
    return resultado


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/token", response_model=Token)
def login_oauth2(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    uow: UoWDep,
    response: Response,
):
    """Login OAuth2 (form-data) — botón Authorize del Swagger."""
    token = autenticar_usuario(uow, form_data.username, form_data.password)
    _set_auth_cookie(response, token)
    return token


@router.post("/login")
def login_json(body: LoginRequest, uow: UoWDep, response: Response):
    """Login JSON — usado por el frontend."""
    token = autenticar_usuario(uow, body.username, body.password)
    _set_auth_cookie(response, token)
    return {
        "mensaje": "Login exitoso",
        "access_token": token.access_token,
        "token_type": "bearer",
    }


# ─── Logout ───────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )
    return {"mensaje": "Sesión cerrada exitosamente"}


# ─── Perfil ───────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UsuarioPublic)
def whoami(current_user: Annotated[Usuario, Depends(get_current_active_user)]):
    return current_user


# ─── Administración (solo ADMIN) ──────────────────────────────────────────────

@router.get("/admin/usuarios", response_model=List[UsuarioPublic])
def list_users(
    _: Annotated[Usuario, Depends(require_role(["ADMIN"]))],
    uow: UoWDep,
):
    return listar_usuarios(uow)


@router.post("/admin/usuarios/{usuario_id}/desactivar", response_model=UsuarioPublic)
def deactivate_user(
    usuario_id: int,
    _: Annotated[Usuario, Depends(require_role(["ADMIN"]))],
    uow: UoWDep,
):
    resultado = set_disabled(uow, usuario_id, disabled=True)
    uow.commit()
    return resultado


@router.post("/admin/usuarios/{usuario_id}/activar", response_model=UsuarioPublic)
def activate_user(
    usuario_id: int,
    _: Annotated[Usuario, Depends(require_role(["ADMIN"]))],
    uow: UoWDep,
):
    resultado = set_disabled(uow, usuario_id, disabled=False)
    uow.commit()
    return resultado
