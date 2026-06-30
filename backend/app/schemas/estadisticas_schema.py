from decimal import Decimal
from pydantic import BaseModel


class VentasPeriodoItem(BaseModel):
    periodo:          str       # 'YYYY-MM-DD' | 'YYYY-Www' | 'YYYY-MM'
    total_ventas:     Decimal
    cantidad_pedidos: int


class ProductoTopItem(BaseModel):
    producto_id:      int
    nombre:           str
    ingresos:         Decimal
    cantidad_vendida: int


class PedidosEstadoItem(BaseModel):
    estado_codigo: str
    cantidad:      int


class IngresoFormaPagoItem(BaseModel):
    forma_pago_codigo: str
    total:             Decimal
    cantidad:          int


class IngresosResponse(BaseModel):
    items:         list[IngresoFormaPagoItem]
    total_general: Decimal


class ResumenResponse(BaseModel):
    ventas_hoy:      Decimal   # total facturado hoy (sin CANCELADO)
    ticket_promedio: Decimal   # promedio de total por pedido (sin CANCELADO)
    pedidos_activos: int       # PENDIENTE + CONFIRMADO + EN_PREP
    ventas_mes:      Decimal   # total facturado en el mes corriente (sin CANCELADO)
