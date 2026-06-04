"""
Seed — FormaPago y EstadoPedido.

Ejecutar:
    python -m app.db.seed_formas_pago

CAMBIO (devolución del profe): sin session.commit() a mano; commit automático del UoW.
"""

from app.models.catalogs import FormaPago, EstadoPedido
from app.unit_of_work import UnitOfWork

FORMAS_PAGO = [
    FormaPago(codigo="MERCADOPAGO",   descripcion="MercadoPago — Checkout API", habilitado=True),
    FormaPago(codigo="EFECTIVO",      descripcion="Efectivo — retiro en local", habilitado=True),
    FormaPago(codigo="TRANSFERENCIA", descripcion="Transferencia bancaria",      habilitado=True),
]

ESTADOS_PEDIDO = [
    EstadoPedido(codigo="PENDIENTE",  descripcion="Pedido pendiente de confirmación", orden=1, es_terminal=False),
    EstadoPedido(codigo="CONFIRMADO", descripcion="Pedido confirmado",                orden=2, es_terminal=False),
    EstadoPedido(codigo="EN_PREP",    descripcion="En preparación",                   orden=3, es_terminal=False),
    EstadoPedido(codigo="EN_CAMINO",  descripcion="En camino",                        orden=4, es_terminal=False),
    EstadoPedido(codigo="ENTREGADO",  descripcion="Entregado",                        orden=5, es_terminal=True),
    EstadoPedido(codigo="CANCELADO",  descripcion="Cancelado",                        orden=6, es_terminal=True),
]


def seed():
    with UnitOfWork() as uow:
        print("── FormaPago ──")
        for fp in FORMAS_PAGO:
            if not uow.formas_pago.get_by_id(fp.codigo):
                uow.formas_pago.add(fp)
                print(f"  ✅ {fp.codigo}")
            else:
                print(f"  ⏭️  Ya existe: {fp.codigo}")

        print("── EstadoPedido ──")
        for ep in ESTADOS_PEDIDO:
            if not uow.estados.get_by_id(ep.codigo):
                uow.estados.add(ep)
                print(f"  ✅ {ep.codigo}")
            else:
                print(f"  ⏭️  Ya existe: {ep.codigo}")

    # commit automático del UoW al salir del `with`
    print("\n✅ Seed de formas de pago y estados completo.")


if __name__ == "__main__":
    seed()