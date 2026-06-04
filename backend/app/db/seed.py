"""
Seed Usuarios — carga los roles obligatorios y un usuario ADMIN inicial.

Ejecutar una sola vez:
    python -m app.db.seed

CAMBIO (devolución del profe): ya NO se llama session.commit() a mano.
Se usa el Unit of Work, que comitea automáticamente al cerrar el bloque `with`.

Roles iniciales:
    ADMIN   → acceso total sin restricciones
    STOCK   → actualiza stock y disponible
    PEDIDOS → avanza estados CONFIRMADO → ENTREGADO
    CLIENT  → opera solo sus propios datos
"""

from sqlmodel import select
from app.core.security import hash_password
from app.models.usuarios.usuario import Rol, Usuario, UsuarioRol
from app.unit_of_work import UnitOfWork

ROLES_INICIALES = [
    Rol(codigo="ADMIN",   nombre="Administrador", descripcion="Acceso total sin restricciones"),
    Rol(codigo="STOCK",   nombre="Stock",          descripcion="Actualiza stock y disponibilidad"),
    Rol(codigo="PEDIDOS", nombre="Pedidos",        descripcion="Gestiona estados de pedidos"),
    Rol(codigo="CLIENT",  nombre="Cliente",        descripcion="Opera solo sus propios datos"),
]

ADMIN_INICIAL = {
    "username": "admin",
    "nombre": "Admin",
    "apellido": "Sistema",
    "email": "admin@foodstore.com",
    "password": "admin1234",
}


def seed():
    # El UoW abre la sesión y comitea solo al salir del `with` (si no hubo error).
    with UnitOfWork() as uow:
        # ── Roles ──────────────────────────────────────────────────────────
        for rol in ROLES_INICIALES:
            exists = uow.session.exec(select(Rol).where(Rol.codigo == rol.codigo)).first()
            if not exists:
                uow.roles.add(rol)
                print(f"  ✅ Rol creado: {rol.codigo}")
            else:
                print(f"  ⏭️  Rol ya existe: {rol.codigo}")

        uow.flush()   # asegura que los roles existan antes de asignarlos

        # ── Usuario ADMIN ──────────────────────────────────────────────────
        admin_exists = uow.session.exec(
            select(Usuario).where(Usuario.username == ADMIN_INICIAL["username"])
        ).first()

        if not admin_exists:
            admin = Usuario(
                username=ADMIN_INICIAL["username"],
                nombre=ADMIN_INICIAL["nombre"],
                apellido=ADMIN_INICIAL["apellido"],
                email=ADMIN_INICIAL["email"],
                hashed_password=hash_password(ADMIN_INICIAL["password"]),
            )
            uow.usuarios.add(admin)
            uow.flush()                       # genera admin.id (sin commitear)
            uow.usuarios.add(UsuarioRol(usuario_id=admin.id, rol_codigo="ADMIN"))
            print(f"  ✅ Usuario admin creado: {ADMIN_INICIAL['username']} / {ADMIN_INICIAL['password']}")
        else:
            print("  ⏭️  Usuario admin ya existe")

    # Al llegar acá, el UoW ya comiteó todo automáticamente.
    print("\n✅ Seed completado.")


if __name__ == "__main__":
    seed()