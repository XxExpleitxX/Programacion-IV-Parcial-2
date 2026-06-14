from datetime import datetime
from typing import List, Optional
from fastapi import HTTPException, status
from app.models import Categoria
from app.schemas import CategoriaCreate, CategoriaUpdate, CategoriaConHijosRead, CategoriaRead
from app.unit_of_work import UnitOfWork


def get_all(
    uow: UnitOfWork,
    offset: int = 0,
    limit: int = 20,
    nombre: Optional[str] = None,
    parent_id: Optional[int] = None,
) -> List[Categoria]:
    return uow.categorias.get_all(offset=offset, limit=limit, nombre=nombre, parent_id=parent_id)


def get_by_id(uow: UnitOfWork, categoria_id: int) -> Categoria:
    categoria = uow.categorias.get_by_id(categoria_id)
    if not categoria or categoria.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Categoría {categoria_id} no encontrada"
        )
    return categoria


def get_subcategorias(uow: UnitOfWork, categoria_id: int) -> List[Categoria]:
    get_by_id(uow, categoria_id)
    return uow.categorias.get_subcategorias(categoria_id)


def get_arbol(uow: UnitOfWork) -> List[CategoriaConHijosRead]:
    todas = uow.categorias.get_all(offset=0, limit=1000)
    
    todas = [c for c in todas if c.deleted_at is None]

    hijos: dict = {}
    for c in todas:
        pid = c.parent_id
        if pid not in hijos:
            hijos[pid] = []
        hijos[pid].append(c)

    def build(cat: Categoria) -> CategoriaConHijosRead:
        return CategoriaConHijosRead(
            id=cat.id,
            nombre=cat.nombre,
            descripcion=cat.descripcion,
            parent_id=cat.parent_id,
            imagen_url=cat.imagen_url,
            subcategorias=[build(h) for h in hijos.get(cat.id, [])],
        )

    return [build(c) for c in hijos.get(None, [])]


def create(uow: UnitOfWork, data: CategoriaCreate) -> Categoria:
    if data.parent_id is not None:
        if not uow.categorias.get_by_id(data.parent_id):
            raise HTTPException(status_code=404, detail=f"Categoría padre {data.parent_id} no encontrada")

    categoria = Categoria(
        nombre=data.nombre,
        descripcion=data.descripcion,
        parent_id=data.parent_id,
        imagen_url=data.imagen_url,
    )
    uow.categorias.add(categoria)
    uow.flush()
    uow.refresh(categoria)
    return categoria


def update(uow: UnitOfWork, categoria_id: int, data: CategoriaUpdate) -> Categoria:
    categoria = get_by_id(uow, categoria_id)
    update_data = data.model_dump(exclude_unset=True)

    if "parent_id" in update_data:
        nuevo_padre_id = update_data["parent_id"]
        if nuevo_padre_id is not None:
            if nuevo_padre_id == categoria_id:
                raise HTTPException(status_code=400, detail="Una categoría no puede ser su propio padre")
            if not uow.categorias.get_by_id(nuevo_padre_id):
                raise HTTPException(status_code=404, detail=f"Categoría padre {nuevo_padre_id} no encontrada")
            if uow.categorias.es_descendiente(nuevo_padre_id, categoria_id):
                raise HTTPException(status_code=400, detail="No se puede asignar una subcategoría como padre (ciclo)")

    for key, value in update_data.items():
        setattr(categoria, key, value)

    categoria.updated_at = datetime.utcnow()
    uow.categorias.add(categoria)
    uow.flush()
    uow.refresh(categoria)
    return categoria


def delete(uow: UnitOfWork, categoria_id: int) -> None:
    categoria = get_by_id(uow, categoria_id)

    # Valida subcategorías activas
    subcats = uow.categorias.get_subcategorias(categoria_id)
    if subcats:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar una categoría que tiene subcategorías activas"
        )

    # Valida productos activos
    productos_activos = uow.categorias.tiene_productos_activos(categoria_id)
    if productos_activos:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar una categoría que tiene productos activos"
        )

    # Soft delete
    categoria.deleted_at = datetime.utcnow()
    uow.categorias.add(categoria)