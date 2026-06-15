"""
Router de autenticación.

- /api/v1 lo aporta el router padre en main.py.
- access token (30 min) en cookie httpOnly + refresh token (7 días) en el body.
- Rate limiting: 5 intentos fallidos por IP en 15 min en login/register → 429.
- El commit es automático (Unit of Work).
"""

from typing import Annotated, List
from fastapi import APIRouter, Depends, Request, Response, status, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from app.core.deps import get_current_active_user, require_role
from app.core.config import settings
from app.core.rate_limit import login_limiter
from app.modules.auth.usuario import (
    Usuario, UsuarioCreate, UsuarioPublic, Token, LoginRequest, RefreshRequest,
)
from app.modules.auth.usuario_service import (
    registrar_usuario,
    autenticar_usuario,
    refrescar_token,
    revocar_refresh_token,
    set_disabled,
    listar_usuarios,
)
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/auth", tags=["Auth"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _set_auth_cookie(response: Response, token: Token):
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token.access_token,
        httponly=True,
        max_age=settings.COOKIE_MAX_AGE,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )


# ─── Registro (rate limited) ──────────────────────────────────────────────────

@router.post("/register", response_model=UsuarioPublic, status_code=status.HTTP_201_CREATED)
def register(data: UsuarioCreate, uow: UoWDep, request: Request):
    """Registra un usuario nuevo. Rol CLIENT por defecto."""
    ip = _client_ip(request)
    login_limiter.assert_not_blocked(ip)
    try:
        return registrar_usuario(uow, data)
    except HTTPException as e:
        if e.status_code in (status.HTTP_409_CONFLICT, status.HTTP_400_BAD_REQUEST):
            login_limiter.register_failure(ip)
        raise


# ─── Login (rate limited) ─────────────────────────────────────────────────────

@router.post("/token", response_model=Token)
def login_oauth2(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    uow: UoWDep,
    response: Response,
    request: Request,
):
    """Login OAuth2 (form-data) — botón Authorize del Swagger."""
    ip = _client_ip(request)
    login_limiter.assert_not_blocked(ip)
    try:
        token = autenticar_usuario(uow, form_data.username, form_data.password)
    except HTTPException as e:
        if e.status_code == status.HTTP_401_UNAUTHORIZED:
            login_limiter.register_failure(ip)
        raise
    _set_auth_cookie(response, token)
    return token


@router.post("/login", response_model=Token)
def login_json(body: LoginRequest, uow: UoWDep, response: Response, request: Request):
    """Login JSON — usado por el frontend. Devuelve access + refresh token."""
    ip = _client_ip(request)
    login_limiter.assert_not_blocked(ip)
    try:
        token = autenticar_usuario(uow, body.username, body.password)
    except HTTPException as e:
        if e.status_code == status.HTTP_401_UNAUTHORIZED:
            login_limiter.register_failure(ip)
        raise
    _set_auth_cookie(response, token)
    return token


# ─── Refresh ──────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=Token)
def refresh(body: RefreshRequest, uow: UoWDep, response: Response):
    """Emite un nuevo access token a partir de un refresh token válido."""
    token = refrescar_token(uow, body.refresh_token)
    _set_auth_cookie(response, token)
    return token


# ─── Logout ───────────────────────────────────────────────────────────────────

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, uow: UoWDep, response: Response):
    """Revoca el refresh token y limpia la cookie."""
    revocar_refresh_token(uow, body.refresh_token)
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )


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
    return set_disabled(uow, usuario_id, disabled=True)


@router.post("/admin/usuarios/{usuario_id}/activar", response_model=UsuarioPublic)
def activate_user(
    usuario_id: int,
    _: Annotated[Usuario, Depends(require_role(["ADMIN"]))],
    uow: UoWDep,
):
    return set_disabled(uow, usuario_id, disabled=False)