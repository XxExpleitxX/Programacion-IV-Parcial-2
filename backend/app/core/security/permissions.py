from typing import Annotated
from fastapi import Depends, HTTPException, status

from app.modules.auth.usuario import Usuario
from app.core.security.oauth2_scheme import oauth2_scheme
from app.core.security.jwt_handler import decode_token
from app.unit_of_work import UnitOfWork, get_uow


# ─────────────────────────────────────────────
# ROLES DEL SISTEMA
# ─────────────────────────────────────────────
ROL_ADMIN    = "ADMIN"
ROL_EDITOR   = "STOCK"      # EDITOR → STOCK en el nuevo sistema
ROL_CONSULTA = "CLIENT" 
ROL_PEDIDOS = "PEDIDOS"    

ROLES_VALIDOS = {ROL_ADMIN, "STOCK", "PEDIDOS", "CLIENT"}


# ─────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────
def _tiene_rol(user: Usuario, *roles: str) -> bool:
    user_roles = user.roles   # property que devuelve List[str]
    return any(r in user_roles for r in roles)


# ─────────────────────────────────────────────
# DEPENDENCIA BASE
# ─────────────────────────────────────────────
def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    uow: Annotated[UnitOfWork, Depends(get_uow)],
) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception

    usuario = uow.usuarios.get_by_username(username)
    if usuario is None:
        raise credentials_exception

    return usuario


# ─────────────────────────────────────────────
# DEPENDENCIAS DE ROL
# ─────────────────────────────────────────────
def require_admin(user: Usuario = Depends(get_current_user)) -> Usuario:
    if not _tiene_rol(user, "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado. Se requiere rol ADMIN.",
        )
    return user


def require_admin_or_editor(user: Usuario = Depends(get_current_user)) -> Usuario:
    if not _tiene_rol(user, "ADMIN", "STOCK"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado. Se requiere rol ADMIN o STOCK.",
        )
    return user


def require_authenticated(user: Usuario = Depends(get_current_user)) -> Usuario:
    return user


def require_roles(*roles_permitidos: str):
    def checker(user: Usuario = Depends(get_current_user)) -> Usuario:
        if not _tiene_rol(user, *roles_permitidos):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No autorizado. Se requiere uno de: {', '.join(roles_permitidos)}.",
            )
        return user
    return checker