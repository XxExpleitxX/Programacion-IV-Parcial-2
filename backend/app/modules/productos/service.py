from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from fastapi import HTTPException
from app.modules.productos.producto import Producto
from app.modules.productos.producto_categoria import ProductoCategoria
from app.schemas import (
    ProductoCreate, ProductoUpdate, ProductoRead, CategoriaRead,
    IngredienteCantidad, IngredienteEnProducto,
)
from app.schemas.pagination import paginate
from app.modules.uploads.service import borrar_por_url
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
    ingredientes = [
        IngredienteEnProducto(
            ingrediente_id=pi.ingrediente_id,
            nombre=pi.ingrediente.nombre if pi.ingrediente else "",
            cantidad=pi.cantidad,
            unidad=pi.unidad_medida.simbolo if getattr(pi, "unidad_medida", None) else None,
            es_alergeno=pi.ingrediente.es_alergeno if pi.ingrediente else False,
        )
        for pi in producto.producto_ingredientes
        if pi.ingrediente
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
        ingredientes=ingredientes,
        imagenes_url=producto.imagenes_url or [],
    )


def _agregar_ingrediente(uow: UnitOfWork, producto_id: int, item: IngredienteCantidad) -> None:
    """Asocia un ingrediente (con su cantidad) a la RECETA del producto.

    No toca el stock del ingrediente: la receta es solo una plantilla. El stock
    de insumos se descuenta al CREAR un pedido y se restaura al cancelarlo
    (ver PedidoService._ajustar_stock).
    """
    ingrediente = uow.ingredientes.get_by_id(item.ingrediente_id)
    if not ingrediente:
        raise HTTPException(status_code=404, detail=f"Ingrediente {item.ingrediente_id} no encontrado")
    cant = float(item.cantidad)
    if cant <= 0:
        raise HTTPException(status_code=422, detail="La cantidad de cada ingrediente debe ser mayor a 0")
    uow.productos.add_ingrediente(
        producto_id, ingrediente.id, cant, unidad_medida_id=ingrediente.unidad_medida_id
    )


def get_all(
    uow: UnitOfWork,
    page: int = 1,
    size: int = 20,
    nombre: Optional[str] = None,
    disponible: Optional[bool] = None,
    categoria_id: Optional[int] = None,
    precio_min: Optional[Decimal] = None,
    precio_max: Optional[Decimal] = None,
) -> dict:
    """Devuelve el envelope de paginación {items, total, page, size, pages}."""
    filtros = dict(
        nombre=nombre, disponible=disponible, categoria_id=categoria_id,
        precio_min=precio_min, precio_max=precio_max,
    )
    productos = uow.productos.get_all(offset=(page - 1) * size, limit=size, **filtros)
    total = uow.productos.count_all(**filtros)
    return paginate([_build_read(p) for p in productos], total, page, size)


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
    if data.es_manufacturado and not data.ingredientes:
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

    # Receta: asocia cada ingrediente con su cantidad y descuenta su stock.
    for item in data.ingredientes:
        _agregar_ingrediente(uow, producto.id, item)

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

    producto.updated_at = datetime.utcnow()

    # Categorías: si vienen, reemplazan las actuales
    if data.categoria_ids is not None:
        uow.productos.clear_categorias(producto)
        uow.flush()
        uow.refresh(producto)
        for cat_id in data.categoria_ids:
            if not uow.categorias.get_by_id(cat_id):
                raise HTTPException(status_code=404, detail=f"Categoría {cat_id} no encontrada")
            uow.productos.add_categoria(producto_id, cat_id)

    # Ingredientes: si vienen, reemplazan la receta actual. Editar la receta NO
    # mueve stock de insumos (es solo una plantilla para futuros pedidos).
    if data.ingredientes is not None:
        uow.productos.clear_ingredientes(producto)
        uow.flush()
        uow.refresh(producto)
        for item in data.ingredientes:
            _agregar_ingrediente(uow, producto_id, item)
        uow.flush()
        uow.refresh(producto)

    # Validación manufacturado: contra el estado FINAL (ya con los ingredientes nuevos)
    if producto.es_manufacturado and not producto.producto_ingredientes:
        raise HTTPException(
            status_code=422,
            detail="Debe cargar un ingrediente para guardarlo"
        )

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


def patch_stock(uow: UnitOfWork, producto_id: int, stock_cantidad: int) -> ProductoRead:
    """Actualiza solo el stock de un producto. Permitido para ADMIN y STOCK."""
    producto = uow.productos.get_by_id(producto_id)
    if not producto or producto.deleted_at is not None:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")
    if stock_cantidad < 0:
        raise HTTPException(status_code=422, detail="El stock no puede ser negativo")
    producto.stock_cantidad = stock_cantidad
    producto.updated_at = datetime.utcnow()
    uow.productos.add(producto)
    uow.flush()
    uow.refresh(producto)
    return _build_read(producto)


def delete(uow: UnitOfWork, producto_id: int) -> None:
    producto = uow.productos.get_by_id(producto_id)
    if not producto or producto.deleted_at is not None:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")
    # Limpia las imágenes del CDN (best-effort) antes del soft-delete.
    for url in (producto.imagenes_url or []):
        borrar_por_url(url)
    producto.deleted_at = datetime.utcnow()
    uow.productos.add(producto)