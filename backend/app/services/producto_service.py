from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from fastapi import HTTPException
from app.models import Producto, ProductoCategoria
from app.schemas import ProductoCreate, ProductoUpdate, ProductoRead, CategoriaRead
from app.unit_of_work import UnitOfWork


def _build_read(producto: Producto) -> ProductoRead:
    categorias = [
        CategoriaRead(
            id=pc.categoria.id,
            nombre=pc.categoria.nombre,
            descripcion=pc.categoria.descripcion,
            parent_id=pc.categoria.parent_id,
            imagen_url=pc.categoria.imagen_url,
        )
        for pc in producto.producto_categorias
        if pc.categoria
    ]
    return ProductoRead(
        id=producto.id,
        nombre=producto.nombre,
        descripcion=producto.descripcion,
        precio_base=producto.precio_base,
        disponible=producto.disponible,
        stock_cantidad=producto.stock_cantidad,
        unidad_venta_id=producto.unidad_venta_id,
        es_manufacturado=producto.es_manufacturado,
        categorias=categorias,
        imagenes_url=producto.imagenes_url or [],
    )


def get_all(
    uow: UnitOfWork,
    offset: int = 0,
    limit: int = 20,
    nombre: Optional[str] = None,
    disponible: Optional[bool] = None,
    categoria_id: Optional[int] = None,
    precio_min: Optional[Decimal] = None,
    precio_max: Optional[Decimal] = None,
) -> List[ProductoRead]:
    productos = uow.productos.get_all(
        offset=offset, limit=limit, nombre=nombre,
        disponible=disponible, categoria_id=categoria_id,
        precio_min=precio_min, precio_max=precio_max,
    )
    return [_build_read(p) for p in productos]


def get_by_id(uow: UnitOfWork, producto_id: int) -> ProductoRead:
    producto = uow.productos.get_by_id(producto_id)
    if not producto or producto.deleted_at is not None:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")
    return _build_read(producto)


def calcular_precio_sugerido(uow: UnitOfWork, producto_id: int, margen: float) -> dict:
    """
    Calcula el precio sugerido de venta basado en el costo de ingredientes
    y un margen de ganancia porcentual.

    margen: número entre 0 y 100 (ej: 30 = 30% de ganancia)
    precio_sugerido = costo_total * (1 + margen / 100)
    """
    if margen < 0 or margen > 1000:
        raise HTTPException(status_code=422, detail="El margen debe estar entre 0 y 1000")

    producto = uow.productos.get_by_id(producto_id)
    if not producto or producto.deleted_at is not None:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")

    if not producto.es_manufacturado:
        raise HTTPException(status_code=422, detail="Solo se puede calcular precio para productos manufacturados")

    if not producto.producto_ingredientes:
        raise HTTPException(status_code=422, detail="El producto no tiene ingredientes cargados")

    # Sumar el costo de cada ingrediente (precio_unitario * cantidad)
    costo_total = sum(
        (pi.ingrediente.precio_unitario if hasattr(pi.ingrediente, 'precio_unitario') else 0) * pi.cantidad
        for pi in producto.producto_ingredientes
        if pi.ingrediente
    )

    precio_sugerido = round(costo_total * (1 + margen / 100), 2)

    return {
        "producto_id": producto_id,
        "nombre": producto.nombre,
        "costo_total": round(costo_total, 2),
        "margen_porcentaje": margen,
        "precio_sugerido": precio_sugerido,
    }


def create(uow: UnitOfWork, data: ProductoCreate) -> ProductoRead:
    # Validación: manufacturado requiere al menos un ingrediente
    if data.es_manufacturado and not data.ingrediente_ids:
        raise HTTPException(
            status_code=422,
            detail="Debe cargar un ingrediente para guardarlo"
        )

    producto = Producto(
        nombre=data.nombre,
        descripcion=data.descripcion,
        precio_base=data.precio_base,
        disponible=data.disponible,
        stock_cantidad=data.stock_cantidad,
        unidad_venta_id=data.unidad_venta_id,
        es_manufacturado=data.es_manufacturado,
        imagenes_url=data.imagenes_url,
    )
    uow.productos.add(producto)
    uow.flush()

    for cat_id in data.categoria_ids:
        if not uow.categorias.get_by_id(cat_id):
            raise HTTPException(status_code=404, detail=f"Categoría {cat_id} no encontrada")
        uow.productos.add_categoria(producto.id, cat_id)

    if hasattr(data, 'ingrediente_ids') and data.ingrediente_ids:
        for ing_id in data.ingrediente_ids:
            uow.productos.add_ingrediente(producto.id, ing_id, 1.0)

    uow.flush()
    uow.refresh(producto)
    return _build_read(producto)


def update(uow: UnitOfWork, producto_id: int, data: ProductoUpdate) -> ProductoRead:
    producto = uow.productos.get_by_id(producto_id)
    if not producto or producto.deleted_at is not None:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")

    for field in ["nombre", "descripcion", "precio_base", "disponible",
                  "stock_cantidad", "unidad_venta_id", "es_manufacturado",
                  "imagenes_url"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(producto, field, val)

    # Revalidar si ahora es manufacturado y no tiene ingredientes
    if producto.es_manufacturado and not producto.producto_ingredientes:
        raise HTTPException(
            status_code=422,
            detail="Debe cargar un ingrediente para guardarlo"
        )

    producto.updated_at = datetime.utcnow()

    if data.categoria_ids is not None:
        uow.productos.clear_categorias(producto)
        uow.flush()
        uow.refresh(producto)
        for cat_id in data.categoria_ids:
            if not uow.categorias.get_by_id(cat_id):
                raise HTTPException(status_code=404, detail=f"Categoría {cat_id} no encontrada")
            uow.productos.add_categoria(producto_id, cat_id)

    uow.productos.add(producto)
    uow.flush()
    uow.refresh(producto)
    return _build_read(producto)


def patch_disponibilidad(uow: UnitOfWork, producto_id: int, disponible: bool) -> ProductoRead:
    producto = uow.productos.get_by_id(producto_id)
    if not producto or producto.deleted_at is not None:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")
    producto.disponible = disponible
    producto.updated_at = datetime.utcnow()
    uow.productos.add(producto)
    uow.flush()
    uow.refresh(producto)
    return _build_read(producto)


def delete(uow: UnitOfWork, producto_id: int) -> None:
    producto = uow.productos.get_by_id(producto_id)
    if not producto or producto.deleted_at is not None:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")
    producto.deleted_at = datetime.utcnow()
    uow.productos.add(producto)