from typing import List, Optional
from sqlmodel import Session, select
from app.modules.categorias.categoria import Categoria
from app.modules.productos.producto_categoria import ProductoCategoria
from app.modules.productos.producto import Producto
from app.repositories.base_repository import BaseRepository


class CategoriaRepository(BaseRepository[Categoria]):
    def __init__(self, session: Session):
        super().__init__(session, Categoria)

    def get_all(
        self,
        offset: int = 0,
        limit: int = 20,
        nombre: Optional[str] = None,
        parent_id: Optional[int] = None,
    ) -> List[Categoria]:
        query = select(Categoria).where(Categoria.deleted_at == None)
        if nombre:
            query = query.where(Categoria.nombre.contains(nombre))
        if parent_id is not None:
            query = query.where(Categoria.parent_id == parent_id)
        return self.session.exec(query.offset(offset).limit(limit)).all()

    def get_raices(self) -> List[Categoria]:
        return self.session.exec(
            select(Categoria)
            .where(Categoria.parent_id == None)
            .where(Categoria.deleted_at == None)
        ).all()

    def get_subcategorias(self, categoria_id: int) -> List[Categoria]:
        return self.session.exec(
            select(Categoria)
            .where(Categoria.parent_id == categoria_id)
            .where(Categoria.deleted_at == None)
        ).all()

    def tiene_productos_activos(self, categoria_id: int) -> bool:
        result = self.session.exec(
            select(ProductoCategoria)
            .join(Producto, ProductoCategoria.producto_id == Producto.id)
            .where(ProductoCategoria.categoria_id == categoria_id)
            .where(Producto.deleted_at == None)
            .where(Producto.disponible == True)
        ).first()
        return result is not None

    def es_descendiente(self, posible_descendiente_id: int, ancestro_id: int) -> bool:
        actual = self.get_by_id(posible_descendiente_id)
        while actual is not None and actual.parent_id is not None:
            if actual.parent_id == ancestro_id:
                return True
            actual = self.get_by_id(actual.parent_id)
        return False