from typing import List, Optional
from decimal import Decimal
from sqlmodel import Session, select
from app.models import Producto, ProductoCategoria, ProductoIngrediente
from app.repositories.base_repository import BaseRepository


class ProductoRepository(BaseRepository[Producto]):
    def __init__(self, session: Session):
        super().__init__(session, Producto)

    def get_all(
        self,
        offset: int = 0,
        limit: int = 20,
        nombre: Optional[str] = None,
        disponible: Optional[bool] = None,
        categoria_id: Optional[int] = None,
        precio_min: Optional[Decimal] = None,
        precio_max: Optional[Decimal] = None,
    ) -> List[Producto]:
        query = select(Producto).where(Producto.deleted_at == None)
        if nombre:
            query = query.where(Producto.nombre.contains(nombre))
        if disponible is not None:
            query = query.where(Producto.disponible == disponible)
        if categoria_id is not None:
            query = query.join(
                ProductoCategoria,
                ProductoCategoria.producto_id == Producto.id
            ).where(ProductoCategoria.categoria_id == categoria_id)
        if precio_min is not None:
            query = query.where(Producto.precio_base >= precio_min)
        if precio_max is not None:
            query = query.where(Producto.precio_base <= precio_max)
        return self.session.exec(query.offset(offset).limit(limit)).all()

    def add_categoria(self, producto_id: int, categoria_id: int) -> None:
        self.session.add(
            ProductoCategoria(producto_id=producto_id, categoria_id=categoria_id)
        )

    def add_ingrediente(self, producto_id: int, ingrediente_id: int, cantidad: float) -> None:
        self.session.add(
            ProductoIngrediente(
                producto_id=producto_id,
                ingrediente_id=ingrediente_id,
                cantidad=cantidad,
            )
        )

    def clear_categorias(self, producto: Producto) -> None:
        for pc in list(producto.producto_categorias):
            self.session.delete(pc)

    def clear_ingredientes(self, producto: Producto) -> None:
        for pi in list(producto.producto_ingredientes):
            self.session.delete(pi)