"""
Seed productos — carga las unidades de medida iniciales.

Ejecutar:
    python -m app.db.seed_productos

CAMBIO (devolución del profe): sin session.commit() a mano; commit automático del UoW.
"""

from sqlmodel import select
from app.models.unidad_medida import UnidadMedida
from app.unit_of_work import UnitOfWork

UNIDADES = [
    UnidadMedida(nombre="Kilogramo", simbolo="kg",  tipo="masa"),
    UnidadMedida(nombre="Gramo",     simbolo="g",   tipo="masa"),
    UnidadMedida(nombre="Litro",     simbolo="L",   tipo="volumen"),
    UnidadMedida(nombre="Mililitro", simbolo="ml",  tipo="volumen"),
    UnidadMedida(nombre="Unidad",    simbolo="u",   tipo="unidad"),
    UnidadMedida(nombre="Docena",    simbolo="doc", tipo="unidad"),
]


def seed():
    with UnitOfWork() as uow:
        for u in UNIDADES:
            existe = uow.session.exec(
                select(UnidadMedida).where(UnidadMedida.simbolo == u.simbolo)
            ).first()
            if not existe:
                uow.session.add(u)
                print(f"  ✅ {u.simbolo:5s} — {u.nombre}")
            else:
                print(f"  ⏭️  Ya existe: {u.simbolo}")

    # commit automático del UoW al salir del `with`
    print("\n✅ Seed de unidades de medida completado.")


if __name__ == "__main__":
    seed()