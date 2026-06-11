"""
Servicio de usuarios — lógica de negocio de autenticación y gestión.
No conoce FastAPI ni HTTP: solo recibe datos, opera sobre la UoW y retorna entidades.
"""

import logging
import hashlib
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.core.config import settings
from app.models.usuarios.usuario import Usuario, UsuarioCreate, Token
from app.unit_of_work import UnitOfWork


def _hash_token(token: str) -> str:
    """SHA-256 del token (64 hex). Nunca guardamos el token crudo."""
    return hashlib.sha256(token.encode()).hexdigest()


def _emitir_tokens(uow: UnitOfWork, usuario: Usuario) -> Token:
    """Crea access + refresh, guarda el hash del refresh y arma el Token."""
    expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
    access_token = create_access_token(
        data={"sub": usuario.username, "roles": usuario.roles},
        expires_delta=timedelta(minutes=expire_minutes),
    )
    refresh_token = create_refresh_token(data={"sub": usuario.username})
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    uow.refresh_tokens.create(
        usuario_id=usuario.id,
        token_hash=_hash_token(refresh_token),
        expires_at=expires_at,
    )
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=expire_minutes * 60,
    )

logger = logging.getLogger("app.auth")   # 👈 para loguear el motivo del fallo (solo en el servidor)


def registrar_usuario(uow: UnitOfWork, data: UsuarioCreate) -> Usuario:
    """
    Registra un usuario nuevo.
    - Valida username y email únicos
    - Hashea la contraseña
    - Asigna rol CLIENTE por defecto
    """
    if uow.usuarios.get_by_username(data.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El username ya está en uso",
        )
    if uow.usuarios.get_by_email(data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El email ya está registrado",
        )

    usuario = Usuario(
        username=data.username,
        nombre=data.nombre,
        apellido=data.apellido,
        email=data.email,
        celular=data.celular,
        hashed_password=hash_password(data.password),
    )
    uow.usuarios.add(usuario)
    uow.flush()  # necesario para obtener el id antes del commit

    # Asigna rol CLIENTE
    uow.usuarios.assign_role(usuario.id, "CLIENT")
    uow.flush()
    uow.refresh(usuario)
    return usuario


def autenticar_usuario(uow: UnitOfWork, username: str, password: str) -> Token:
    """
    Valida credenciales y genera un JWT.
    - Busca el usuario por username
    - Verifica la contraseña con bcrypt
    - Genera token con sub=username y roles en el payload

    Nota de seguridad: la respuesta al cliente es SIEMPRE genérica
    ("Usuario o contraseña incorrectos") para evitar user enumeration.
    El motivo real se registra solo en el log del servidor.
    """
    usuario = uow.usuarios.get_by_username(username)

    # Caso 1: el usuario no existe
    if not usuario:
        logger.warning("Login fallido: el usuario '%s' no existe", username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",   # mensaje genérico
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Caso 2: existe pero la contraseña no coincide
    if not verify_password(password, usuario.hashed_password):
        logger.warning("Login fallido: contraseña incorrecta para '%s'", username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",   # mismo mensaje genérico
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Caso 3: credenciales OK pero la cuenta está desactivada
    if usuario.disabled:
        logger.warning("Login fallido: cuenta desactivada '%s'", username)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada",
        )

    # Credenciales OK → emitir access + refresh (y guardar el refresh)
    return _emitir_tokens(uow, usuario)


def refrescar_token(uow: UnitOfWork, refresh_token: str) -> Token:
    """
    Valida un refresh token y emite un nuevo access token.
    - Verifica que el JWT sea válido y de tipo 'refresh'
    - Verifica que esté guardado, no revocado y no expirado
    """
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token inválido")

    stored = uow.refresh_tokens.get_valid(_hash_token(refresh_token))
    if not stored:
        raise HTTPException(status_code=401, detail="Refresh token inválido o revocado")

    usuario = uow.usuarios.get_by_username(payload.get("sub"))
    if not usuario or usuario.disabled:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
    access_token = create_access_token(
        data={"sub": usuario.username, "roles": usuario.roles},
        expires_delta=timedelta(minutes=expire_minutes),
    )
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,   # se mantiene el mismo refresh
        token_type="bearer",
        expires_in=expire_minutes * 60,
    )


def revocar_refresh_token(uow: UnitOfWork, refresh_token: str) -> None:
    """Invalida un refresh token (logout)."""
    uow.refresh_tokens.revoke(_hash_token(refresh_token))


def set_disabled(uow: UnitOfWork, usuario_id: int, disabled: bool) -> Usuario:
    """Activa o desactiva una cuenta."""
    usuario = uow.usuarios.get_by_id(usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    usuario.disabled = disabled
    uow.flush()  # el service nunca comitea; el UoW lo hace solo
    uow.refresh(usuario)
    return usuario


def listar_usuarios(uow: UnitOfWork) -> list[Usuario]:
    return uow.usuarios.get_all_active()