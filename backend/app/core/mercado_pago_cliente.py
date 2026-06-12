"""
Cliente MercadoPago — instancia única del SDK.
El access token sale del .env (MP_ACCESS_TOKEN). Nunca se expone al frontend.
"""
import mercadopago
from app.core.config import settings

sdk = mercadopago.SDK(settings.MP_ACCESS_TOKEN)


def get_sdk() -> mercadopago.SDK:
    return sdk