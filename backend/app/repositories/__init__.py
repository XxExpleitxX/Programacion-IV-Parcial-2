# Solo infra compartida vive en este paquete. Los repos de cada feature
# viven en app/modules/<feature>/repository.py y se importan desde ahí
# (el Unit of Work los cablea). Evita imports circulares con base_repository.
from app.repositories.base_repository import BaseRepository
from app.repositories.usuario_repository import UsuarioRepository

__all__ = ["BaseRepository", "UsuarioRepository"]
