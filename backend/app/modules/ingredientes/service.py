"""
Servicio de ingredientes — lógica de negocio pura.

Regla UoW:
  - Sin commit() — lo controla el router
"""

from typing import List, Optional
from fastapi import HTTPException, status
from app.modules.ingredientes.ingrediente import Ingrediente
from app.schemas import IngredienteCreate, IngredienteUpdate
from app.unit_of_work import UnitOfWork


def get_all(
    uow: UnitOfWork,
    offset: int = 0,
    limit: int = 20,
    nombre: Optional[str] = None,
) -> List[Ingrediente]:
    return uow.ingredientes.get_all(offset=offset, limit=limit, nombre=nombre)


def get_by_id(uow: UnitOfWork, ingrediente_id: int) -> Ingrediente:
    ingrediente = uow.ingredientes.get_by_id(ingrediente_id)
    if not ingrediente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingrediente {ingrediente_id} no encontrado",
        )
    return ingrediente


def create(uow: UnitOfWork, data: IngredienteCreate) -> Ingrediente:
    ingrediente = Ingrediente(**data.model_dump())
    uow.ingredientes.add(ingrediente)
    uow.flush()
    uow.refresh(ingrediente)
    return ingrediente
    # ✅ Sin commit — lo hace el router


def update(uow: UnitOfWork, ingrediente_id: int, data: IngredienteUpdate) -> Ingrediente:
    ingrediente = get_by_id(uow, ingrediente_id)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ingrediente, key, value)

    uow.ingredientes.add(ingrediente)
    uow.flush()
    uow.refresh(ingrediente)
    return ingrediente


def delete(uow: UnitOfWork, ingrediente_id: int) -> None:
    ingrediente = get_by_id(uow, ingrediente_id)

    # No se puede eliminar un ingrediente que está en la receta de un producto ACTIVO.
    en_uso = uow.productos.get_manufacturados_que_usan([ingrediente_id])
    if en_uso:
        nombres = ", ".join(p.nombre for p in en_uso[:3])
        extra = "…" if len(en_uso) > 3 else ""
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: el ingrediente está en uso en "
                   f"{len(en_uso)} producto(s) ({nombres}{extra}).",
        )

    # Limpia referencias de receta huérfanas (de productos ya eliminados) para que
    # el borrado físico no falle por la FK NOT NULL de producto_ingredientes.
    uow.productos.delete_refs_a_ingrediente(ingrediente_id)
    uow.ingredientes.delete(ingrediente)
    # ✅ Sin commit — lo hace el router
