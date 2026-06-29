"""
Modelos del Usuarios — Identidad & Acceso.
"""

from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy.orm import relationship
from pydantic import EmailStr


# ─────────────────────────────────────────────
# ROL — tabla catálogo (seed obligatorio)
# ─────────────────────────────────────────────
class Rol(SQLModel, table=True):
    __tablename__ = "roles"

    codigo: str = Field(max_length=20, primary_key=True)
    nombre: str = Field(max_length=50, unique=True)
    descripcion: Optional[str] = Field(default=None)

    usuario_roles: List["UsuarioRol"] = Relationship(back_populates="rol")


# ─────────────────────────────────────────────
# USUARIO
# ─────────────────────────────────────────────
class Usuario(SQLModel, table=True):
    __tablename__ = "usuarios"

    id: Optional[int] = Field(default=None, primary_key=True)

    nombre:    str           = Field(max_length=80)
    apellido:  str           = Field(max_length=80)
    email:     str           = Field(max_length=254, unique=True, index=True)
    celular:   Optional[str] = Field(default=None, max_length=20)
    username:  str           = Field(max_length=100, unique=True, index=True)
    hashed_password: str     = Field(max_length=255)
    disabled:  bool          = Field(default=False)

    created_at: datetime           = Field(default_factory=datetime.utcnow)
    updated_at: datetime           = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)

    # Relación con UsuarioRol — especificamos FK explícitamente
    usuario_roles: List["UsuarioRol"] = Relationship(
        back_populates="usuario",
        sa_relationship_kwargs={
            "primaryjoin": "Usuario.id == foreign(UsuarioRol.usuario_id)",
            "foreign_keys": "[UsuarioRol.usuario_id]",
        },
    )
    refresh_tokens: List["RefreshToken"] = Relationship(back_populates="usuario")

    @property
    def roles(self) -> List[str]:
        return [ur.rol_codigo for ur in self.usuario_roles]

    @property
    def full_name(self) -> str:
        return f"{self.nombre} {self.apellido}"


# ─────────────────────────────────────────────
# USUARIO_ROL — pivote N:M
# ─────────────────────────────────────────────
class UsuarioRol(SQLModel, table=True):
    __tablename__ = "usuario_roles"

    usuario_id: Optional[int] = Field(
        default=None, foreign_key="usuarios.id", primary_key=True
    )
    rol_codigo: str = Field(
        max_length=20, foreign_key="roles.codigo", primary_key=True
    )
    asignado_por_id: Optional[int] = Field(
        default=None, foreign_key="usuarios.id", nullable=True
    )
    expires_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # FK explícita para evitar error de ambigüedad en la relación
    usuario: Optional[Usuario] = Relationship(
        back_populates="usuario_roles",
        sa_relationship_kwargs={
            "primaryjoin": "UsuarioRol.usuario_id == Usuario.id",
            "foreign_keys": "[UsuarioRol.usuario_id]",
        },
    )
    rol: Optional[Rol] = Relationship(back_populates="usuario_roles")


# ─────────────────────────────────────────────
# REFRESH TOKEN
# ─────────────────────────────────────────────
class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_tokens"

    id:         Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int           = Field(foreign_key="usuarios.id")
    token_hash: str           = Field(max_length=64, unique=True)
    expires_at: datetime      = Field()
    revoked_at: Optional[datetime] = Field(default=None)
    created_at: datetime      = Field(default_factory=datetime.utcnow)

    usuario: Optional[Usuario] = Relationship(back_populates="refresh_tokens")


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────
class UsuarioCreate(SQLModel):
    username:  str = Field(max_length=100)
    nombre:    str = Field(max_length=80)
    apellido:  str = Field(max_length=80)
    email:     EmailStr = Field(max_length=254)
    celular:   Optional[str] = Field(default=None, max_length=20)
    password:  str = Field(min_length=8, max_length=128)


class UsuarioPublic(SQLModel):
    id:        int
    username:  str
    full_name: str
    email:     str
    roles:     List[str] = []
    disabled:  bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(SQLModel):
    access_token:  str
    refresh_token: Optional[str] = None   
    token_type:    str = "bearer"
    expires_in:    int


class RefreshRequest(SQLModel):
    refresh_token: str


class LoginRequest(SQLModel):
    username: str
    password: str