"""
Router de Estadísticas — solo ADMIN.
Todos los endpoints son de SOLO LECTURA.

  GET /api/v1/estadisticas/resumen              → KPI cards
  GET /api/v1/estadisticas/ventas               → ventas por período (LineChart)
  GET /api/v1/estadisticas/productos-top        → top productos (BarChart)
  GET /api/v1/estadisticas/pedidos-por-estado   → distribución (PieChart)
  GET /api/v1/estadisticas/ingresos             → ingresos por forma de pago
"""
from datetime import date, datetime, timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query

from app.core.deps import require_role
from app.modules.auth.usuario import Usuario
from app.schemas.estadisticas_schema import (
    ResumenResponse, VentasPeriodoItem, ProductoTopItem,
    PedidosEstadoItem, IngresosResponse,
)
from app.modules.estadisticas.service import EstadisticasService
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/estadisticas", tags=["Estadísticas"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]
AdminDep = Depends(require_role(["ADMIN"]))


@router.get("/resumen", response_model=ResumenResponse)
def resumen(uow: UoWDep, _: Usuario = AdminDep):
    return EstadisticasService.resumen(uow)


@router.get("/ventas", response_model=list[VentasPeriodoItem])
def ventas_periodo(
    uow: UoWDep,
    _: Usuario = AdminDep,
    desde: Annotated[Optional[date], Query(description="Fecha inicial (YYYY-MM-DD)")] = None,
    hasta: Annotated[Optional[date], Query(description="Fecha final (YYYY-MM-DD)")] = None,
    agrupacion: Annotated[str, Query(pattern="^(day|week|month)$")] = "day",
):
    # Por defecto: últimos 30 días
    hoy = datetime.utcnow().date()
    desde = desde or (hoy - timedelta(days=30))
    hasta = hasta or hoy
    return EstadisticasService.ventas_periodo(uow, desde, hasta, agrupacion)


@router.get("/productos-top", response_model=list[ProductoTopItem])
def productos_top(
    uow: UoWDep,
    _: Usuario = AdminDep,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
):
    return EstadisticasService.productos_top(uow, limit)


@router.get("/pedidos-por-estado", response_model=list[PedidosEstadoItem])
def pedidos_por_estado(uow: UoWDep, _: Usuario = AdminDep):
    return EstadisticasService.pedidos_por_estado(uow)


@router.get("/ingresos", response_model=IngresosResponse)
def ingresos(
    uow: UoWDep,
    _: Usuario = AdminDep,
    desde: Annotated[Optional[date], Query()] = None,
    hasta: Annotated[Optional[date], Query()] = None,
):
    return EstadisticasService.ingresos_por_forma_pago(uow, desde, hasta)
