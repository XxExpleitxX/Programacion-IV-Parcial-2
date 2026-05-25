"""
Unit of Work — gestión transaccional atómica.

Regla fundamental:
  - El SERVICE nunca llama commit(). Solo usa flush() y refresh().
  - El ROUTER llama uow.commit() explícitamente después del service.
  - Si el service lanza una excepción → __exit__ hace rollback automático.
  - __exit__ NUNCA hace commit — solo cierra la sesión (o rollback si hubo error).
"""

from sqlmodel import Session
from app.core.database import engine
from app.repositories import (
    CategoriaRepository,
    IngredienteRepository,
    ProductoRepository,
)
from app.repositories.pedido_repository import PedidoRepository, HistorialRepository
from app.models.usuarios.usuario_repository import UsuarioRepository, RolRepository


class UnitOfWork:
    def __init__(self):
        self.session:      Session               | None = None
        self.categorias:   CategoriaRepository   | None = None
        self.ingredientes: IngredienteRepository | None = None
        self.productos:    ProductoRepository    | None = None
        self.pedidos:      PedidoRepository      | None = None
        self.historial:    HistorialRepository   | None = None
        self.usuarios:     UsuarioRepository     | None = None
        self.roles:        RolRepository         | None = None

    def __enter__(self) -> "UnitOfWork":
        self.session      = Session(engine)
        self.categorias   = CategoriaRepository(self.session)
        self.ingredientes = IngredienteRepository(self.session)
        self.productos    = ProductoRepository(self.session)
        self.pedidos      = PedidoRepository(self.session)
        self.historial    = HistorialRepository(self.session)
        self.usuarios     = UsuarioRepository(self.session)
        self.roles        = RolRepository(self.session)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.session.rollback()
        self.session.close()

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()

    def flush(self) -> None:
        self.session.flush()

    def refresh(self, entity) -> None:
        self.session.refresh(entity)


def get_uow():
    with UnitOfWork() as uow:
        yield uow