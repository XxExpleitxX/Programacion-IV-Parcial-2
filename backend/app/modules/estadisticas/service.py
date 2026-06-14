"""
EstadisticasService — lógica de cálculo de KPIs (stateless, vía UoW).

Cuantiza todos los montos a 2 decimales (EST-04: dinero como Decimal).
Las queries crudas viven en EstadisticasRepository; acá se ensamblan los schemas.
"""
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP

from app.unit_of_work import UnitOfWork
from app.schemas.estadisticas_schema import (
    VentasPeriodoItem, ProductoTopItem, PedidosEstadoItem,
    IngresoFormaPagoItem, IngresosResponse, ResumenResponse,
)

_DOS_DEC = Decimal("0.01")


def _money(v) -> Decimal:
    """Normaliza a Decimal(10,2) — EST-04."""
    return Decimal(str(v)).quantize(_DOS_DEC, rounding=ROUND_HALF_UP)


class EstadisticasService:

    @staticmethod
    def ventas_periodo(uow: UnitOfWork, desde: date, hasta: date, agrupacion: str) -> list[VentasPeriodoItem]:
        if agrupacion not in ("day", "week", "month"):
            agrupacion = "day"
        filas = uow.estadisticas.get_ventas_periodo(desde, hasta, agrupacion)
        return [
            VentasPeriodoItem(periodo=p, total_ventas=_money(t), cantidad_pedidos=c)
            for (p, t, c) in filas
        ]

    @staticmethod
    def productos_top(uow: UnitOfWork, limit: int = 10) -> list[ProductoTopItem]:
        filas = uow.estadisticas.get_productos_top(limit)
        return [
            ProductoTopItem(
                producto_id=pid, nombre=nombre,
                ingresos=_money(ingresos), cantidad_vendida=int(cant),
            )
            for (pid, nombre, ingresos, cant) in filas
        ]

    @staticmethod
    def pedidos_por_estado(uow: UnitOfWork) -> list[PedidosEstadoItem]:
        filas = uow.estadisticas.get_pedidos_por_estado()
        return [PedidosEstadoItem(estado_codigo=e, cantidad=int(c)) for (e, c) in filas]

    @staticmethod
    def ingresos_por_forma_pago(uow: UnitOfWork, desde: date | None, hasta: date | None) -> IngresosResponse:
        filas = uow.estadisticas.get_ingresos_por_forma_pago(desde, hasta)
        items = [
            IngresoFormaPagoItem(forma_pago_codigo=fp, total=_money(total), cantidad=int(cant))
            for (fp, total, cant) in filas
        ]
        total_general = _money(sum((i.total for i in items), Decimal("0.00")))
        return IngresosResponse(items=items, total_general=total_general)

    @staticmethod
    def resumen(uow: UnitOfWork) -> ResumenResponse:
        hoy = datetime.utcnow().date()
        inicio_mes = hoy.replace(day=1)
        return ResumenResponse(
            ventas_hoy      = _money(uow.estadisticas.total_ventas_desde(hoy)),
            ticket_promedio = _money(uow.estadisticas.ticket_promedio()),
            pedidos_activos = int(uow.estadisticas.contar_pedidos_activos()),
            ventas_mes      = _money(uow.estadisticas.total_ventas_desde(inicio_mes)),
        )
