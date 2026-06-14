"""
Router de pagos — MercadoPago.
POST   /pagos/crear            → crea el pago con el token de tarjeta (CLIENT)
POST   /pagos/webhook          → IPN de MercadoPago (público)
GET    /pagos/{pedido_id}      → consulta el pago de un pedido (dueño/ADMIN)
"""
from typing import Annotated
from fastapi import APIRouter, Depends, Request, status

from app.core.deps import get_current_active_user
from app.models.usuarios.usuario import Usuario
from app.schemas.pago_schema import CrearPagoRequest, PagoResponse
from app.modules.pagos.service import crear_pago, procesar_webhook, get_pago_por_pedido
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/pagos", tags=["Pagos"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]
UserDep = Annotated[Usuario, Depends(get_current_active_user)]


@router.post("/crear", response_model=PagoResponse, status_code=status.HTTP_201_CREATED)
def crear_pago_endpoint(body: CrearPagoRequest, uow: UoWDep, current_user: UserDep):
    # Si el pago se aprueba, el Service confirma el pedido y encola el evento WS;
    # get_uow lo emite DESPUÉS del commit (RN-06).
    return crear_pago(uow, current_user.id, body)


@router.post("/webhook")
async def webhook(request: Request, uow: UoWDep):
    """IPN de MercadoPago. Acepta el id por body JSON o por query params."""
    payment_id = None
    try:
        body = await request.json()
    except Exception:
        body = {}

    # Formato body: { "type": "payment", "data": { "id": "123" } }
    if body.get("type") == "payment":
        payment_id = (body.get("data") or {}).get("id")
    # Formato query: ?topic=payment&id=123  (o ?type=payment&data.id=123)
    if not payment_id:
        qp = request.query_params
        if qp.get("topic") == "payment" or qp.get("type") == "payment":
            payment_id = qp.get("id") or qp.get("data.id")

    if payment_id:
        # procesar_webhook sincroniza el pago y encola el evento WS (post-commit).
        procesar_webhook(uow, str(payment_id))

    return {"status": "ok"}


@router.get("/{pedido_id}", response_model=PagoResponse)
def get_pago(pedido_id: int, uow: UoWDep, current_user: UserDep):
    return get_pago_por_pedido(uow, pedido_id, current_user.id, current_user.roles)