"""
Seed Usuarios — carga los roles obligatorios y un usuario ADMIN inicial.

Ejecutar una sola vez:
    python -m app.db.seed

Roles iniciales (código → descripción):
    ADMIN   → acceso total sin restricciones
    STOCK   → actualiza stock y disponible
    PEDIDOS → avanza estados CONFIRMADO → ENTREGADO
    CLIENT  → opera solo sus propios datos
"""

from sqlmodel import Session, select
from app.core.database import engine
from app.core.security import hash_password
from app.models.usuarios.usuario import Rol, Usuario, UsuarioRol

ROLES_INICIALES = [
    Rol(codigo="ADMIN",   nombre="Administrador",  descripcion="Acceso total sin restricciones"),
    Rol(codigo="STOCK",   nombre="Stock",           descripcion="Actualiza stock y disponibilidad"),
    Rol(codigo="PEDIDOS", nombre="Pedidos",         descripcion="Gestiona estados de pedidos"),
    Rol(codigo="CLIENT",  nombre="Cliente",         descripcion="Opera solo sus propios datos"),
]

ADMIN_INICIAL = {
    "username": "admin",
    "nombre": "Admin",
    "apellido": "Sistema",
    "email": "admin@foodstore.com",
    "password": "admin1234",
}


def seed():
    with Session(engine) as session:
        # ── Roles ──────────────────────────────────────────────────────────
        for rol in ROLES_INICIALES:
            exists = session.exec(select(Rol).where(Rol.codigo == rol.codigo)).first()
            if not exists:
                session.add(rol)
                print(f"  ✅ Rol creado: {rol.codigo}")
            else:
                print(f"  ⏭️  Rol ya existe: {rol.codigo}")

        session.commit()

        # ── Usuario ADMIN ──────────────────────────────────────────────────
        admin_exists = session.exec(
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
            session.add(admin)
            session.flush()

            # Asignar rol ADMIN
            session.add(UsuarioRol(usuario_id=admin.id, rol_codigo="ADMIN"))
            session.commit()
            print(f"  ✅ Usuario admin creado: {ADMIN_INICIAL['username']} / {ADMIN_INICIAL['password']}")
        else:
            print(f"  ⏭️  Usuario admin ya existe")

        print("\n✅ Seed completado.")


if __name__ == "__main__":
    seed()
