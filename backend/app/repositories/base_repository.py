from typing import Generic, TypeVar, Type, List, Optional
from sqlmodel import Session, SQLModel, select

T = TypeVar("T", bound=SQLModel)


class BaseRepository(Generic[T]):
    """
    Repositorio genérico con operaciones CRUD básicas.
    NO hace commit: el commit lo coordina la Unit of Work.
    """

    def __init__(self, session: Session, model: Type[T]):
        self.session = session
        self.model = model

    def get_by_id(self, id: int) -> Optional[T]:
        return self.session.get(self.model, id)

    def get_all(self, offset: int = 0, limit: int = 20) -> List[T]:
        query = select(self.model).offset(offset).limit(limit)
        return self.session.exec(query).all()

    def add(self, entity: T) -> T:
        self.session.add(entity)
        return entity

    def delete(self, entity: T) -> None:
        self.session.delete(entity)

    def flush(self) -> None:
        """Empuja los cambios pendientes a la BD sin commitear (para obtener IDs)."""
        self.session.flush()

    def refresh(self, entity: T) -> None:
        self.session.refresh(entity)
