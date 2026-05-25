"""
Seed — FormaPago y EstadoPedido.

Ejecutar:
    python -m app.db.seed_formas_pago
"""

from sqlmodel import Session, select
from app.core.database import engine
from app.models.catalogs import FormaPago, EstadoPedido

FORMAS_PAGO = [
    FormaPago(codigo="MERCADOPAGO",  descripcion="MercadoPago — Checkout API", habilitado=True),
    FormaPago(codigo="EFECTIVO",     descripcion="Efectivo — retiro en local",   habilitado=True),
    FormaPago(codigo="TRANSFERENCIA",descripcion="Transferencia bancaria",        habilitado=True),
]

ESTADOS_PEDIDO = [
    EstadoPedido(codigo="PENDIENTE",   descripcion="Pedido pendiente de confirmación", orden=1, es_terminal=False),
    EstadoPedido(codigo="CONFIRMADO",  descripcion="Pedido confirmado",                orden=2, es_terminal=False),
    EstadoPedido(codigo="EN_PREP",     descripcion="En preparación",                   orden=3, es_terminal=False),
    EstadoPedido(codigo="EN_CAMINO",   descripcion="En camino",                        orden=4, es_terminal=False),
    EstadoPedido(codigo="ENTREGADO",   descripcion="Entregado",                        orden=5, es_terminal=True),
    EstadoPedido(codigo="CANCELADO",   descripcion="Cancelado",                        orden=6, es_terminal=True),
]


def seed():
    with Session(engine) as session:
        print("── FormaPago ──")
        for fp in FORMAS_PAGO:
            if not session.get(FormaPago, fp.codigo):
                session.add(fp)
                print(f"  ✅ {fp.codigo}")
            else:
                print(f"  ⏭️  Ya existe: {fp.codigo}")

        print("── EstadoPedido ──")
        for ep in ESTADOS_PEDIDO:
            if not session.get(EstadoPedido, ep.codigo):
                session.add(ep)
                print(f"  ✅ {ep.codigo}")
            else:
                print(f"  ⏭️  Ya existe: {ep.codigo}")

        session.commit()
        print("\n✅ Seed de las formas de pago completo.")


if __name__ == "__main__":
    seed()
