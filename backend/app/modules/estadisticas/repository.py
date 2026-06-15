"""
EstadisticasRepository — queries de SOLO LECTURA para KPIs y métricas.

Reglas de negocio específicas para estadísticas (marcadas como EST-XX) que se aplican:
  EST-01: nunca incluir pedidos CANCELADO en ingresos ni cantidades.
  EST-02: usar subtotal_snap de DetallePedido para ingresos por producto.
  EST-03: solo pagos con mp_status='approved' al calcular ingresos confirmados.
  EST-04: los montos se devuelven como Decimal (el service los cuantiza a 2 dec).
  EST-05: las queries de período aceptan `desde`/`hasta` como date y filtran con BETWEEN.

Nota de portabilidad: el agrupamiento por período se hace en Python (no con
DATE_TRUNC) para que funcione igual en MySQL (prod), SQLite (tests) y PostgreSQL.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlmodel import Session, select

from app.modules.pedidos.pedido import Pedido
from app.modules.pedidos.detalle_pedido import DetallePedido
from app.modules.pagos.pago import Pago

ESTADOS_ACTIVOS = ("PENDIENTE", "CONFIRMADO", "EN_PREP")


def _periodo_key(dt: datetime, agrupacion: str) -> str:
    """Bucket de un datetime según la agrupación pedida."""
    if agrupacion == "month":
        return dt.strftime("%Y-%m")
    if agrupacion == "week":
        iso = dt.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"
    return dt.strftime("%Y-%m-%d")   # 'day' (default)


class EstadisticasRepository:
    def __init__(self, session: Session):
        self.session = session

    # ── Ventas agrupadas por período (EST-01, EST-05) ─────────────────────────
    def get_ventas_periodo(
        self, desde: date, hasta: date, agrupacion: str = "day"
    ) -> list[tuple[str, Decimal, int]]:
        rows = self.session.exec(
            select(Pedido.created_at, Pedido.total)
            .where(Pedido.deleted_at == None)            # noqa: E711
            .where(Pedido.estado_codigo != "CANCELADO")  # EST-01
            .where(func.date(Pedido.created_at) >= desde)  # EST-05 (BETWEEN)
            .where(func.date(Pedido.created_at) <= hasta)
        ).all()

        buckets: dict[str, list] = {}
        for created_at, total in rows:
            key = _periodo_key(created_at, agrupacion)
            acc = buckets.setdefault(key, [Decimal("0.00"), 0])
            acc[0] += Decimal(str(total))
            acc[1] += 1
        return [(k, buckets[k][0], buckets[k][1]) for k in sorted(buckets)]

    # ── Top productos por ingresos (EST-01, EST-02) ───────────────────────────
    def get_productos_top(self, limit: int = 10) -> list[tuple[int, str, Decimal, int]]:
        return self.session.exec(
            select(
                DetallePedido.producto_id,
                DetallePedido.nombre_snapshot,
                func.sum(DetallePedido.subtotal_snap),  # EST-02
                func.sum(DetallePedido.cantidad),
            )
            .join(Pedido, Pedido.id == DetallePedido.pedido_id)
            .where(Pedido.deleted_at == None)            # noqa: E711
            .where(Pedido.estado_codigo != "CANCELADO")  # EST-01
            .group_by(DetallePedido.producto_id, DetallePedido.nombre_snapshot)
            .order_by(func.sum(DetallePedido.subtotal_snap).desc())
            .limit(limit)
        ).all()

    # ── Distribución de pedidos por estado ────────────────────────────────────
    def get_pedidos_por_estado(self) -> list[tuple[str, int]]:
        return self.session.exec(
            select(Pedido.estado_codigo, func.count(Pedido.id))
            .where(Pedido.deleted_at == None)            # noqa: E711
            .group_by(Pedido.estado_codigo)
        ).all()

    # ── Ingresos por forma de pago (EST-01, EST-03) ───────────────────────────
    def get_ingresos_por_forma_pago(
        self, desde: Optional[date] = None, hasta: Optional[date] = None
    ) -> list[tuple[str, Decimal, int]]:
        query = (
            select(Pedido.forma_pago_codigo, func.sum(Pedido.total), func.count(Pedido.id))
            .join(Pago, Pago.pedido_id == Pedido.id)
            .where(Pedido.deleted_at == None)            # noqa: E711
            .where(Pedido.estado_codigo != "CANCELADO")  # EST-01
            .where(Pago.mp_status == "approved")          # EST-03
        )
        if desde:
            query = query.where(func.date(Pedido.created_at) >= desde)
        if hasta:
            query = query.where(func.date(Pedido.created_at) <= hasta)
        return self.session.exec(
            query.group_by(Pedido.forma_pago_codigo)
        ).all()

    # ── KPIs del resumen (cada uno es una query) ──────────────────────────────
    def total_ventas_desde(self, desde: date) -> Decimal:
        val = self.session.exec(
            select(func.coalesce(func.sum(Pedido.total), 0))
            .where(Pedido.deleted_at == None)            # noqa: E711
            .where(Pedido.estado_codigo != "CANCELADO")  # EST-01
            .where(func.date(Pedido.created_at) >= desde)
        ).one()
        return Decimal(str(val))

    def ticket_promedio(self) -> Decimal:
        val = self.session.exec(
            select(func.coalesce(func.avg(Pedido.total), 0))
            .where(Pedido.deleted_at == None)            # noqa: E711
            .where(Pedido.estado_codigo != "CANCELADO")  # EST-01
        ).one()
        return Decimal(str(val))

    def contar_pedidos_activos(self) -> int:
        return self.session.exec(
            select(func.count(Pedido.id))
            .where(Pedido.deleted_at == None)            # noqa: E711
            .where(Pedido.estado_codigo.in_(ESTADOS_ACTIVOS))
        ).one()
