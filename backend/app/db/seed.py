
from app.core.security import hash_password
from app.modules.auth.usuario import Rol, Usuario
from app.modules.pedidos.catalogs import FormaPago, EstadoPedido
from app.modules.unidades.unidad_medida import UnidadMedida
from app.unit_of_work import UnitOfWork


# ── 1. Roles ────────────────────────────────────────────────────────────────
ROLES = [
    Rol(codigo="ADMIN",   nombre="Administrador", descripcion="Acceso total sin restricciones"),
    Rol(codigo="STOCK",   nombre="Stock",         descripcion="Actualiza stock y disponibilidad"),
    Rol(codigo="PEDIDOS", nombre="Pedidos",       descripcion="Gestiona estados de pedidos"),
    Rol(codigo="CLIENT",  nombre="Cliente",       descripcion="Opera solo sus propios datos"),
]

# ── 2. Estados del pedido ──────────────────
ESTADOS_PEDIDO = [
    EstadoPedido(codigo="PENDIENTE",  descripcion="Pedido creado, pago pendiente", orden=1, es_terminal=False),
    EstadoPedido(codigo="CONFIRMADO", descripcion="Pago procesado y confirmado",   orden=2, es_terminal=False),
    EstadoPedido(codigo="EN_PREP",    descripcion="En preparación en cocina",      orden=3, es_terminal=False),
    EstadoPedido(codigo="ENTREGADO",  descripcion="Entrega confirmada",            orden=4, es_terminal=True),
    EstadoPedido(codigo="CANCELADO",  descripcion="Pedido cancelado",              orden=5, es_terminal=True),
]

# ── 3. Formas de pago ─────────────────────────────────────────────────────────
FORMAS_PAGO = [
    FormaPago(codigo="MERCADOPAGO",   descripcion="MercadoPago — Checkout PRO",  habilitado=True),
    FormaPago(codigo="EFECTIVO",      descripcion="Efectivo — retiro en local",  habilitado=True),
    FormaPago(codigo="TRANSFERENCIA", descripcion="Transferencia bancaria",      habilitado=True),
]

# ── 4. Unidades de medida ─────────────────────────────────────────
UNIDADES = [
    UnidadMedida(nombre="kilogramo", simbolo="kg",        tipo="peso"),
    UnidadMedida(nombre="gramo",     simbolo="g",         tipo="peso"),
    UnidadMedida(nombre="litro",     simbolo="L",         tipo="volumen"),
    UnidadMedida(nombre="mililitro", simbolo="ml",        tipo="volumen"),
    UnidadMedida(nombre="unidad",    simbolo="ud",        tipo="contable"),
    UnidadMedida(nombre="porciones", simbolo="porciones", tipo="contable"),
]

# ── 5. Usuarios del seed (login por email → username == email) ────────────────
# Obligatorio: el admin. Los demás son de cortesía para probar/demostrar cada rol.
USUARIOS = [
    {"email": "admin@foodstore.com",   "nombre": "Admin",   "apellido": "Sistema", "password": "Admin1234!",   "rol": "ADMIN"},
    {"email": "stock@foodstore.com",   "nombre": "Stock",   "apellido": "Demo",    "password": "Stock1234!",   "rol": "STOCK"},
    {"email": "pedidos@foodstore.com", "nombre": "Pedidos", "apellido": "Demo",    "password": "Pedidos1234!", "rol": "PEDIDOS"},
    {"email": "cliente@foodstore.com", "nombre": "Cliente", "apellido": "Demo",    "password": "Cliente1234!", "rol": "CLIENT"},
]


def seed():
    with UnitOfWork() as uow:

        print("── 1. Roles ──")
        for rol in ROLES:
            if not uow.roles.get_by_id(rol.codigo):
                uow.roles.add(rol)
                print(f"  ✅ {rol.codigo}")
            else:
                print(f"  ⏭️  ya existe: {rol.codigo}")

        print("── 2. Estados del pedido ──")
        for ep in ESTADOS_PEDIDO:
            if not uow.estados.get_by_id(ep.codigo):
                uow.estados.add(ep)
                print(f"  ✅ {ep.codigo}")
            else:
                print(f"  ⏭️  ya existe: {ep.codigo}")

        print("── 3. Formas de pago ──")
        for fp in FORMAS_PAGO:
            if not uow.formas_pago.get_by_id(fp.codigo):
                uow.formas_pago.add(fp)
                print(f"  ✅ {fp.codigo}")
            else:
                print(f"  ⏭️  ya existe: {fp.codigo}")

        print("── 4. Unidades de medida ──")
        for u in UNIDADES:
            if not uow.unidades.get_by_simbolo(u.simbolo):
                uow.unidades.add(u)
                print(f"  ✅ {u.simbolo:9s} — {u.nombre}")
            else:
                print(f"  ⏭️  ya existe: {u.simbolo}")

        # Aseguramos que los roles existan antes de asignarlos
        uow.flush()

        print("── 5. Usuarios ──")
        for u in USUARIOS:
            if uow.usuarios.get_by_username(u["email"]):
                print(f"  ⏭️  ya existe: {u['email']}")
                continue
            nuevo = Usuario(
                username=u["email"],          # el front manda el email como username
                nombre=u["nombre"],
                apellido=u["apellido"],
                email=u["email"],
                hashed_password=hash_password(u["password"]),
            )
            uow.usuarios.add(nuevo)
            uow.flush()                       # genera nuevo.id (sin commitear)
            uow.usuarios.assign_role(nuevo.id, u["rol"])
            print(f"  ✅ {u['email']} / {u['password']}  ({u['rol']})")

    # Al salir del `with`, el UoW comitea todo automáticamente.
    print("\n✅ Seed completo.")


if __name__ == "__main__":
    seed()