from typing import Optional, List
from sqlmodel import Session, select
from app.modules.auth.usuario import Usuario
from app.modules.auth.usuario import UsuarioRol, Rol
from app.repositories.base_repository import BaseRepository
 
 
class UsuarioRepository(BaseRepository[Usuario]):
    def __init__(self, session: Session):
        super().__init__(session, Usuario)
 
    def get_by_username(self, username: str) -> Optional[Usuario]:
        return self.session.exec(
            select(Usuario).where(Usuario.username == username)
        ).first()
 
    def get_by_email(self, email: str) -> Optional[Usuario]:
        return self.session.exec(
            select(Usuario).where(Usuario.email == email)
        ).first()
 
    def get_all(
        self,
        offset: int = 0,
        limit: int = 20,
        rol: Optional[str] = None,
        disabled: Optional[bool] = None,
    ) -> List[Usuario]:
        query = select(Usuario).where(Usuario.deleted_at == None)
        if disabled is not None:
            query = query.where(Usuario.disabled == disabled)
        if rol is not None:
            query = query.join(
                UsuarioRol, UsuarioRol.usuario_id == Usuario.id
            ).where(UsuarioRol.rol_codigo == rol.upper())
        return list(self.session.exec(query.offset(offset).limit(limit)).all())
 
    def get_all_active(self) -> list[Usuario]:
        return self.get_all()
 
    def assign_role(self, usuario_id: int, rol_codigo: str, asignado_por_id: int | None = None):
        existing = self.session.exec(
            select(UsuarioRol).where(
                UsuarioRol.usuario_id == usuario_id,
                UsuarioRol.rol_codigo == rol_codigo,
            )
        ).first()
        if not existing:
            self.session.add(UsuarioRol(
                usuario_id=usuario_id,
                rol_codigo=rol_codigo,
                asignado_por_id=asignado_por_id,
            ))
 
    def remove_role(self, usuario_id: int, rol_codigo: str) -> None:
        ur = self.session.exec(
            select(UsuarioRol).where(
                UsuarioRol.usuario_id == usuario_id,
                UsuarioRol.rol_codigo == rol_codigo,
            )
        ).first()
        if ur:
            self.session.delete(ur)