from app.core.security.password_hasher import hash_password, verify_password
from app.core.security.jwt_handler import (
    create_access_token,
    create_refresh_token,
    decode_token,
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.core.security.oauth2_scheme import oauth2_scheme
from app.core.security.permissions import (
    get_current_user,
    require_admin,
    require_admin_or_editor,
    require_authenticated,
    require_roles,
    ROL_ADMIN,
    ROL_EDITOR,
    ROL_CONSULTA,
    ROLES_VALIDOS,
)

# ── Aliases para compatibilidad con deps.py ──────────────────────────────────
# deps.py importa decode_access_token y get_token_from_request
# que viven en security.py (el archivo plano del Dominio 1).
# Los re-exportamos acá para que ambos sistemas convivan.

from app.core.security.jwt_handler import decode_token as decode_access_token

from fastapi import Request

def get_token_from_request(request: Request) -> str | None:
    from app.core.config import settings
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1]
    return request.cookies.get(getattr(settings, "COOKIE_NAME", "access_token"))


__all__ = [
    # password
    "hash_password", "verify_password",
    # jwt
    "create_access_token", "create_refresh_token", "decode_token", "decode_access_token",
    "SECRET_KEY", "ALGORITHM", "ACCESS_TOKEN_EXPIRE_MINUTES",
    # oauth2
    "oauth2_scheme",
    # permisos
    "get_current_user",
    "require_admin", "require_admin_or_editor", "require_authenticated",
    "require_roles",
    "ROL_ADMIN", "ROL_EDITOR", "ROL_CONSULTA", "ROLES_VALIDOS",
    # compat deps.py
    "get_token_from_request",
]