from typing import List, Optional
from sqlmodel import Session, select
from app.models import Ingrediente
from app.repositories.base_repository import BaseRepository


class IngredienteRepository(BaseRepository[Ingrediente]):
    def __init__(self, session: Session):
        super().__init__(session, Ingrediente)

    def get_all(
        self,
        offset: int = 0,
        limit: int = 20,
        nombre: Optional[str] = None,
    ) -> List[Ingrediente]:
        query = select(Ingrediente)
        if nombre:
            query = query.where(Ingrediente.nombre.contains(nombre))
        return self.session.exec(query.offset(offset).limit(limit)).all()
