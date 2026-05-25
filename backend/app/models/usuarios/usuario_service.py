"""
Servicio de usuarios — lógica de negocio de autenticación y gestión.
No conoce FastAPI ni HTTP: solo recibe datos, opera sobre la UoW y retorna entidades.
"""

from fastapi import HTTPException, status
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings
from app.models.usuarios.usuario import Usuario, UsuarioCreate, Token
from app.unit_of_work import UnitOfWork
from datetime import timedelta


def registrar_usuario(uow: UnitOfWork, data: UsuarioCreate) -> Usuario:
    """
    Registra un usuario nuevo.
    - Valida username y email únicos
    - Hashea la contraseña
    - Asigna rol CLIENT por defecto
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

    # Asigna rol CLIENT por defecto
    uow.usuarios.assign_role(usuario.id, "CLIENT")
    uow.commit()
    uow.refresh(usuario)
    return usuario


def autenticar_usuario(uow: UnitOfWork, username: str, password: str) -> Token:
    """
    Valida credenciales y genera un JWT.
    - Busca el usuario por username
    - Verifica la contraseña con bcrypt
    - Genera token con sub=username y roles en el payload
    """
    usuario = uow.usuarios.get_by_username(username)

    if not usuario or not verify_password(password, usuario.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if usuario.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada",
        )

    expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
    access_token = create_access_token(
        data={
            "sub": usuario.username,
            "roles": usuario.roles,  # ["ADMIN"] o ["CLIENT"] etc.
        },
        expires_delta=timedelta(minutes=expire_minutes),
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=expire_minutes * 60,
    )


def set_disabled(uow: UnitOfWork, usuario_id: int, disabled: bool) -> Usuario:
    """Activa o desactiva una cuenta."""
    usuario = uow.usuarios.get_by_id(usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    usuario.disabled = disabled
    uow.commit()
    uow.refresh(usuario)
    return usuario


def listar_usuarios(uow: UnitOfWork) -> list[Usuario]:
    return uow.usuarios.get_all_active()
