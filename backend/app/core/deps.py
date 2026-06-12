"""
Dependencias FastAPI para autenticación y autorización.

Uso en routers:
    current_user: Annotated[Usuario, Depends(get_current_active_user)]
    _admin:       Annotated[Usuario, Depends(require_role(["ADMIN"]))]
"""

from typing import Annotated
from fastapi import Depends, HTTPException, Request, status

from app.core.security import decode_access_token, get_token_from_request
from app.models.usuarios.usuario import Usuario
from app.unit_of_work import UnitOfWork, get_uow


def get_current_user(
    request: Request,
    uow: Annotated[UnitOfWork, Depends(get_uow)],
) -> Usuario:
    """
    Lee el token desde cookie o header, lo valida y devuelve el Usuario.
    Lanza 401 si el token es inválido o el usuario no existe.

    El acceso a la BD pasa por el repositorio (uow.usuarios), nunca por la
    sesión directa: una sola vía de acceso a datos en toda la app.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o token inválido",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = get_token_from_request(request)
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    username: str = payload.get("sub")
    if not username:
        raise credentials_exception

    usuario = uow.usuarios.get_by_username(username)
    if usuario is None:
        raise credentials_exception

    return usuario


def get_current_active_user(
    current_user: Annotated[Usuario, Depends(get_current_user)],
) -> Usuario:
    """Igual que get_current_user pero además verifica que la cuenta esté activa."""
    if current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada",
        )
    return current_user


def require_role(roles: list[str]):
    """
    Factory de dependencias para RBAC.

    Uso:
        Depends(require_role(["ADMIN"]))
        Depends(require_role(["ADMIN", "STOCK"]))

    El usuario debe tener AL MENOS UNO de los roles indicados.
    """
    def _check(
        current_user: Annotated[Usuario, Depends(get_current_active_user)],
    ) -> Usuario:
        user_roles = current_user.roles  # property que devuelve lista de códigos
        if not any(r in user_roles for r in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere uno de estos roles: {roles}",
            )
        return current_user
    return _check
