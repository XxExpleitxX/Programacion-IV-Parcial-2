"""
Seed único del sistema — carga TODOS los datos iniciales obligatorios.

Ejecutar (un solo comando, como pide el checklist CE-05):
    python -m app.db.seed

Carga, en orden:
    1. Roles            → ADMIN, STOCK, PEDIDOS, CLIENT
    2. EstadoPedido     → 5 estados: PENDIENTE, CONFIRMADO, EN_PREP, ENTREGADO, CANCELADO
    3. FormaPago        → MERCADOPAGO, EFECTIVO, TRANSFERENCIA
    4. UnidadMedida     → kg, g, L, ml, ud, porciones
    5. Usuario admin    → admin@foodstore.com (username == email) / Admin1234!  (rol ADMIN)

El commit es automático: lo hace el Unit of Work al cerrar el bloque `with`
(si no hubo error). No se llama commit() a mano.
Es idempotente: si un registro ya existe, lo saltea.
"""

from sqlmodel import select

from app.core.security import hash_password
from app.models.usuarios.usuario import Rol, Usuario, UsuarioRol
from app.models.catalogs import FormaPago, EstadoPedido
from app.models.unidad_medida import UnidadMedida
from app.unit_of_work import UnitOfWork


# ── 1. Roles ────────────────────────────────────────────────────────────────
ROLES = [
    Rol(codigo="ADMIN",   nombre="Administrador", descripcion="Acceso total sin restricciones"),
    Rol(codigo="STOCK",   nombre="Stock",         descripcion="Actualiza stock y disponibilidad"),
    Rol(codigo="PEDIDOS", nombre="Pedidos",       descripcion="Gestiona estados de pedidos"),
    Rol(codigo="CLIENT",  nombre="Cliente",       descripcion="Opera solo sus propios datos"),
]

# ── 2. Estados del pedido (UML v7: 5 estados, sin EN_CAMINO) ──────────────────
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

# ── 4. Unidades de medida (spec 12.2) ─────────────────────────────────────────
UNIDADES = [
    UnidadMedida(nombre="kilogramo", simbolo="kg",        tipo="peso"),
    UnidadMedida(nombre="gramo",     simbolo="g",         tipo="peso"),
    UnidadMedida(nombre="litro",     simbolo="L",         tipo="volumen"),
    UnidadMedida(nombre="mililitro", simbolo="ml",        tipo="volumen"),
    UnidadMedida(nombre="unidad",    simbolo="ud",        tipo="contable"),
    UnidadMedida(nombre="porciones", simbolo="porciones", tipo="contable"),
]

# ── 5. Usuario admin (login es por email → username = email) ──────────────────
ADMIN = {
    "username": "admin@foodstore.com",   # el login busca por username; el front manda el email
    "nombre":   "Admin",
    "apellido": "Sistema",
    "email":    "admin@foodstore.com",
    "password": "Admin1234!",            # spec 12.2 — cambiar en producción
}


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
            existe = uow.session.exec(
                select(UnidadMedida).where(UnidadMedida.simbolo == u.simbolo)
            ).first()
            if not existe:
                uow.session.add(u)
                print(f"  ✅ {u.simbolo:9s} — {u.nombre}")
            else:
                print(f"  ⏭️  ya existe: {u.simbolo}")

        # Aseguramos que roles existan antes de asignar el rol del admin
        uow.flush()

        print("── 5. Usuario admin ──")
        admin_existe = uow.session.exec(
            select(Usuario).where(Usuario.username == ADMIN["username"])
        ).first()

        if not admin_existe:
            admin = Usuario(
                username=ADMIN["username"],
                nombre=ADMIN["nombre"],
                apellido=ADMIN["apellido"],
                email=ADMIN["email"],
                hashed_password=hash_password(ADMIN["password"]),
            )
            uow.usuarios.add(admin)
            uow.flush()                       # genera admin.id (sin commitear)
            uow.session.add(UsuarioRol(usuario_id=admin.id, rol_codigo="ADMIN"))
            print(f"  ✅ {ADMIN['email']} / {ADMIN['password']}")
        else:
            print("  ⏭️  el admin ya existe")

    # Al salir del `with`, el UoW comitea todo automáticamente.
    print("\n✅ Seed completo.")


if __name__ == "__main__":
    seed()