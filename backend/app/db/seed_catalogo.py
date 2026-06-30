from decimal import Decimal

from app.modules.categorias.categoria import Categoria
from app.modules.productos import service as producto_service
from app.schemas import ProductoCreate
from app.unit_of_work import UnitOfWork


# ── Imágenes por tipo (Unsplash, formato ?w=600&q=80) ─────────────────────────
IMG = {
    "burger":   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
    "pizza":    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
    "papas":    "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80",
    "empanada": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
    "postre":   "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80",
    "bebida":   "https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=600&q=80",
    "generica": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
}


def imagen_por_nombre(nombre: str) -> str:
    n = nombre.lower()
    if "pizza" in n:                                   return IMG["pizza"]
    if any(k in n for k in ("burger", "hamburg", "doble")): return IMG["burger"]
    if "empanada" in n:                                return IMG["empanada"]
    if any(k in n for k in ("papa", "frita", "nugget", "aros")): return IMG["papas"]
    if any(k in n for k in ("helado", "postre", "flan", "brownie")): return IMG["postre"]
    if any(k in n for k in ("gaseosa", "bebida", "agua", "cerveza", "jugo")): return IMG["bebida"]
    return IMG["generica"]


# ── Categorías a asegurar ─────────────────────────────────────────────────────
CATEGORIAS = ["Hamburguesas", "Pizzas", "Empanadas", "Papas y Snacks", "Postres", "Bebidas"]

# ── Menú: (nombre, descripción, precio, stock, categoría) ─────────────────────
PRODUCTOS = [
    ("Hamburguesa Clásica",            "Carne vacuna, lechuga, tomate y queso cheddar",        4500, 50, "Hamburguesas"),
    ("Hamburguesa Cheddar & Bacon",    "Doble cheddar, panceta crocante y salsa de la casa",   5800, 40, "Hamburguesas"),
    ("Hamburguesa Doble",              "Doble medallón de carne con doble queso",              6900, 35, "Hamburguesas"),
    ("Hamburguesa Veggie",            "Medallón de garbanzos, palta y vegetales grillados",   5200, 25, "Hamburguesas"),
    ("Pizza Muzzarella",               "Salsa de tomate y abundante muzzarella",               6000, 30, "Pizzas"),
    ("Pizza Napolitana",               "Muzzarella, tomate en rodajas y ajo",                  7200, 30, "Pizzas"),
    ("Pizza Especial",                 "Muzzarella, jamón, morrón y aceitunas",                8500, 25, "Pizzas"),
    ("Empanada de Pollo",              "Pollo desmenuzado con verdeo",                         1200, 80, "Empanadas"),
    ("Empanada de Jamón y Queso",      "Jamón cocido y muzzarella",                            1200, 80, "Empanadas"),
    ("Papas Fritas",                   "Porción de papas fritas crocantes",                    3000, 60, "Papas y Snacks"),
    ("Papas con Cheddar",              "Papas fritas con cheddar y panceta",                   4200, 45, "Papas y Snacks"),
    ("Aros de Cebolla",                "Aros de cebolla rebozados",                            3500, 40, "Papas y Snacks"),
    ("Nuggets de Pollo x6",            "Seis nuggets de pollo con salsa a elección",           4000, 50, "Papas y Snacks"),
    ("Brownie con Helado",             "Brownie tibio con helado de crema",                    3800, 30, "Postres"),
    ("Flan Casero",                    "Flan con dulce de leche y crema",                      2500, 30, "Postres"),
    ("Gaseosa 500ml",                  "Línea Coca-Cola — 500ml",                              1500, 100, "Bebidas"),
    ("Agua Mineral 500ml",             "Agua mineral sin gas",                                 1000, 100, "Bebidas"),
    ("Cerveza Artesanal",              "Pinta de cerveza artesanal rubia",                     2800, 40, "Bebidas"),
]


def seed_catalogo():
    with UnitOfWork() as uow:
        # 1. Categorías (crear las que falten) ────────────────────────────────
        print("── Categorías ──")
        existentes = {c.nombre: c for c in uow.categorias.get_all(offset=0, limit=1000)}
        for nombre in CATEGORIAS:
            if nombre not in existentes:
                cat = Categoria(nombre=nombre)
                uow.categorias.add(cat)
                uow.flush()
                existentes[nombre] = cat
                print(f"  ✅ {nombre}")
            else:
                print(f"  ⏭️  ya existe: {nombre}")
        cat_id = {n: c.id for n, c in existentes.items()}

        # 2. Productos (idempotente por nombre) ────────────────────────────────
        print("── Productos ──")
        nombres_existentes = {p.nombre.lower() for p in uow.productos.get_all(offset=0, limit=1000)}
        for nombre, desc, precio, stock, categoria in PRODUCTOS:
            if nombre.lower() in nombres_existentes:
                print(f"  ⏭️  ya existe: {nombre}")
                continue
            producto_service.create(uow, ProductoCreate(
                nombre=nombre,
                descripcion=desc,
                precio_base=Decimal(str(precio)),
                disponible=True,
                stock_cantidad=stock,
                es_manufacturado=False,
                categoria_ids=[cat_id[categoria]] if categoria in cat_id else [],
                ingrediente_ids=[],
                imagenes_url=[imagen_por_nombre(nombre)],
            ))
            print(f"  ✅ {nombre}  (${precio})")

        # 3. Backfill: imagen a TODO producto que no tenga ─────────────────────
        print("── Backfill de imágenes ──")
        for p in uow.productos.get_all(offset=0, limit=1000):
            if not p.imagenes_url:
                p.imagenes_url = [imagen_por_nombre(p.nombre)]
                uow.productos.add(p)
                print(f"  🖼️  {p.nombre}")

    print("\n✅ Catálogo cargado.")


if __name__ == "__main__":
    seed_catalogo()
