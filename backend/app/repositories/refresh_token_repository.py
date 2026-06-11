"""
RefreshTokenRepository — persistencia de refresh tokens (para poder invalidarlos).

Se guarda el SHA-256 del token (token_hash), nunca el token crudo.
"""
from datetime import datetime
from typing import Optional
from sqlmodel import Session, select

from app.models.usuarios.usuario import RefreshToken
from app.repositories.base_repository import BaseRepository


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    def __init__(self, session: Session):
        super().__init__(session, RefreshToken)

    def create(self, usuario_id: int, token_hash: str, expires_at: datetime) -> RefreshToken:
        rt = RefreshToken(usuario_id=usuario_id, token_hash=token_hash, expires_at=expires_at)
        self.session.add(rt)
        return rt

    def get_valid(self, token_hash: str) -> Optional[RefreshToken]:
        """Devuelve el refresh token solo si existe, no está revocado y no expiró."""
        rt = self.session.exec(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        ).first()
        if not rt or rt.revoked_at is not None or rt.expires_at < datetime.utcnow():
            return None
        return rt

    def revoke(self, token_hash: str) -> None:
        rt = self.session.exec(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        ).first()
        if rt and rt.revoked_at is None:
            rt.revoked_at = datetime.utcnow()
            self.session.add(rt)