from app.modules.ingredientes.ingrediente import Ingrediente
from app.unit_of_work import UnitOfWork


# (nombre, precio_unitario, stock_disponible, es_alergeno, simbolo_unidad)
INGREDIENTES = [
    # Panes / masas / tapas (alérgeno: gluten)
    ("Pan de hamburguesa",      400.0,  300, True,  "ud"),
    ("Masa de pizza",           500.0,  200, True,  "ud"),
    ("Tapa de empanada",        120.0, 1000, True,  "ud"),
    # Carnes / proteínas
    ("Carne picada",              8.0, 20000, False, "g"),
    ("Pollo",                     7.0, 20000, False, "g"),
    ("Panceta",                  12.0,  8000, False, "g"),
    ("Jamón",                    11.0,  8000, False, "g"),
    ("Medallón veggie",           6.0,  6000, False, "g"),
    # Lácteos (alérgeno)
    ("Queso cheddar",            10.0, 10000, True,  "g"),
    ("Muzzarella",                9.0, 15000, True,  "g"),
    # Vegetales / otros
    ("Lechuga",                   2.0,  6000, False, "g"),
    ("Tomate",                    3.0, 10000, False, "g"),
    ("Cebolla de verdeo",         3.0,  4000, False, "g"),
    ("Palta",                     8.0,  4000, False, "g"),
    ("Morrón",                    4.0,  4000, False, "g"),
    ("Aceitunas",                 7.0,  3000, False, "g"),
    ("Ajo",                       4.0,  2000, False, "g"),
    # Salsas
    ("Salsa de tomate",           2.0, 10000, False, "g"),
    ("Salsa cheddar",             5.0,  4000, True,  "g"),
]


def seed_ingredientes():
    with UnitOfWork() as uow:
        existentes = {i.nombre.lower() for i in uow.ingredientes.get_all(offset=0, limit=5000)}

        # Mapa símbolo → id de unidad (una sola consulta por símbolo)
        uid = {}
        for s in {row[4] for row in INGREDIENTES}:
            u = uow.unidades.get_by_simbolo(s)
            uid[s] = u.id if u else None
            if u is None:
                print(f"  ⚠️  unidad '{s}' no existe (corré: python -m app.db.seed)")

        print("── Ingredientes ──")
        for nombre, precio, stock, alergeno, simbolo in INGREDIENTES:
            if nombre.lower() in existentes:
                print(f"  ⏭️  ya existe: {nombre}")
                continue
            uow.ingredientes.add(Ingrediente(
                nombre=nombre,
                precio_unitario=precio,
                stock_disponible=stock,
                es_alergeno=alergeno,
                unidad_medida_id=uid.get(simbolo),
            ))
            print(f"  ✅ {nombre}  (${precio}/{simbolo}, stock {stock}{', alérgeno' if alergeno else ''})")

    print("\n✅ Ingredientes cargados.")


if __name__ == "__main__":
    seed_ingredientes()
