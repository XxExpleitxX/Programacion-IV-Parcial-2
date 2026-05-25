"""
Servicio de autenticación.
Contiene la lógica de negocio: validar credenciales, registrar usuarios.
NO sabe de HTTP; los routers se encargan de eso.
"""
from fastapi import HTTPException, status
from app.models import Usuario
from app.schemas import RegistroRequest, TokenResponse
from app.unit_of_work import UnitOfWork
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    ROLES_VALIDOS,
)


def autenticar_usuario(uow: UnitOfWork, username: str, password: str) -> TokenResponse:
    """
    Valida credenciales y devuelve un token JWT si son correctas.
    Lanza HTTP 401 si fallan.
    """
    usuario = uow.usuarios.get_by_username(username)
    if not usuario or not verify_password(password, usuario.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": usuario.username, "rol": usuario.rol})
    return TokenResponse(
        access_token=token,
        rol=usuario.rol,
        username=usuario.username,
    )


def registrar_usuario(uow: UnitOfWork, data: RegistroRequest) -> Usuario:
    """
    Registra un usuario nuevo con la contraseña hasheada.
    Valida que el username no exista y que el rol sea válido.
    """
    if uow.usuarios.get_by_username(data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ese username ya existe",
        )
    if data.rol not in ROLES_VALIDOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rol inválido. Debe ser uno de: {', '.join(sorted(ROLES_VALIDOS))}",
        )
    nuevo = Usuario(
        username=data.username,
        password=hash_password(data.password),
        rol=data.rol,
    )
    uow.usuarios.add(nuevo)
    uow.commit()
    uow.refresh(nuevo)
    return nuevo
