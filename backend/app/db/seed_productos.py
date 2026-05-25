"""
Seed productos — carga las unidades de medida iniciales.

Ejecutar:
    python -m app.db.seed_productos
"""

from sqlmodel import Session, select
from app.core.database import engine
from app.models.unidad_medida import UnidadMedida

UNIDADES = [
    UnidadMedida(nombre="Kilogramo",  simbolo="kg",  tipo="masa"),
    UnidadMedida(nombre="Gramo",      simbolo="g",   tipo="masa"),
    UnidadMedida(nombre="Litro",      simbolo="L",   tipo="volumen"),
    UnidadMedida(nombre="Mililitro",  simbolo="ml",  tipo="volumen"),
    UnidadMedida(nombre="Unidad",      simbolo="u",   tipo="unidad"),
    UnidadMedida(nombre="Docena",     simbolo="doc", tipo="unidad"),
]


def seed():
    with Session(engine) as session:
        for u in UNIDADES:
            existe = session.exec(
                select(UnidadMedida).where(UnidadMedida.simbolo == u.simbolo)
            ).first()
            if not existe:
                session.add(u)
                print(f"  ✅ {u.simbolo:5s} — {u.nombre}")
            else:
                print(f"  ⏭️  Ya existe: {u.simbolo}")
        session.commit()
        print("\n✅ Seed de los productos completados.")


if __name__ == "__main__":
    seed()
