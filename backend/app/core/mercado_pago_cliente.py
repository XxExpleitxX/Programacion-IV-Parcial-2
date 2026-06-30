import mercadopago
from app.core.config import settings

sdk = mercadopago.SDK(settings.MP_ACCESS_TOKEN)


def get_sdk() -> mercadopago.SDK:
    return sdk