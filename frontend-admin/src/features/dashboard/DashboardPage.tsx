/**
 * DashboardPage — Panel de estadísticas (solo ADMIN).
 *
 * Gráficos implementados (spec §11):
 *   1. LineChart  → ventas por período (total_ventas + cantidad_pedidos)
 *   2. BarChart   → top productos por ingresos
 *   3. PieChart   → distribución de pedidos por estado
 *   4. BarChart   → ingresos por forma de pago (horizontal)
 *
 * KPI cards (4): ventas hoy, ticket promedio, pedidos activos, ventas mes.
 * TanStack Query con refetch cada 60 seg para datos frescos.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { estadisticasApi } from '../../shared/api'

// ── Paleta de colores coherente con el resto del admin ────────────────────────
const COLORS_ESTADO: Record<string, string> = {
  PENDIENTE:  '#EF9F27',
  CONFIRMADO: '#378ADD',
  EN_PREP:    '#1D9E75',
  ENTREGADO:  '#639922',
  CANCELADO:  '#E24B4A',
}
const COLORS_PAGO = ['#378ADD', '#1D9E75', '#7F77DD']
const COLOR_VENTAS  = '#378ADD'
const COLOR_PEDIDOS = '#1D9E75'
const COLOR_BAR     = '#7F77DD'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const fmtCompacto = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-100">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── Skeleton de carga ─────────────────────────────────────────────────────────
function Skeleton({ h = 'h-64' }: { h?: string }) {
  return (
    <div className={`${h} bg-card border border-border rounded-xl animate-pulse`} />
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const [agrupacion, setAgrupacion] = useState<'day' | 'week' | 'month'>('day')

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: resumen, isLoading: loadResumen } = useQuery({
    queryKey: ['estadisticas', 'resumen'],
    queryFn: () => estadisticasApi.resumen(),
    refetchInterval: 60_000,
  })

  const { data: ventas = [], isLoading: loadVentas } = useQuery({
    queryKey: ['estadisticas', 'ventas', agrupacion],
    queryFn: () => estadisticasApi.ventas({ agrupacion }),
    refetchInterval: 60_000,
  })

  const { data: productosTop = [], isLoading: loadTop } = useQuery({
    queryKey: ['estadisticas', 'productosTop'],
    queryFn: () => estadisticasApi.productosTop(8),
    refetchInterval: 60_000,
  })

  const { data: porEstado = [], isLoading: loadEstado } = useQuery({
    queryKey: ['estadisticas', 'pedidosPorEstado'],
    queryFn: () => estadisticasApi.pedidosPorEstado(),
    refetchInterval: 60_000,
  })

  const { data: ingresosData, isLoading: loadIngresos } = useQuery({
    queryKey: ['estadisticas', 'ingresos'],
    queryFn: () => estadisticasApi.ingresos(),
    refetchInterval: 60_000,
  })

  // ── Data transformations ──────────────────────────────────────────────────
  const ventasData = ventas.map(v => ({
    ...v,
    total_ventas:     Number(v.total_ventas),
    cantidad_pedidos: Number(v.cantidad_pedidos),
    // etiqueta corta para el eje X
    label: agrupacion === 'month'
      ? v.periodo.slice(0, 7)
      : agrupacion === 'week'
      ? v.periodo.replace(/^\d{4}-/, '')
      : v.periodo.slice(5),  // MM-DD
  }))

  const topData = productosTop.map(p => ({
    nombre: p.nombre.length > 18 ? p.nombre.slice(0, 15) + '…' : p.nombre,
    ingresos: Number(p.ingresos),
    vendidos: p.cantidad_vendida,
  }))

  const estadoData = porEstado.map(e => ({
    name:     e.estado_codigo,
    value:    e.cantidad,
    color:    COLORS_ESTADO[e.estado_codigo] ?? '#888',
  }))

  const pagosData = (ingresosData?.items ?? []).map(i => ({
    name:  i.forma_pago_codigo,
    total: Number(i.total),
    cant:  i.cantidad,
  }))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">📊 Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Métricas del negocio en tiempo real</p>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadResumen ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} h="h-24" />)
        ) : (
          <>
            <KpiCard
              label="Ventas hoy"
              value={fmt(Number(resumen?.ventas_hoy ?? 0))}
              sub="sin pedidos cancelados"
            />
            <KpiCard
              label="Ticket promedio"
              value={fmt(Number(resumen?.ticket_promedio ?? 0))}
              sub="por pedido"
            />
            <KpiCard
              label="Pedidos activos"
              value={String(resumen?.pedidos_activos ?? 0)}
              sub="pendiente + confirmado + en prep"
            />
            <KpiCard
              label="Ventas este mes"
              value={fmt(Number(resumen?.ventas_mes ?? 0))}
              sub="mes corriente"
            />
          </>
        )}
      </div>

      {/* ── Ventas por período (LineChart) ─────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-base font-medium text-slate-100">Ventas por período</h2>
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAgrupacion(a)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  agrupacion === a
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {a === 'day' ? 'Día' : a === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </div>

        {loadVentas ? <Skeleton /> : (
          ventasData.length === 0 ? (
            <EmptyChart mensaje="Sin ventas en este período" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ventasData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={fmtCompacto}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={54}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#cbd5e1' }}
                  // @ts-ignore — recharts v3 Formatter type conflict
                  formatter={(value: any, name: string) =>
                    name === 'total_ventas' ? [fmt(value as number), 'Ingresos'] : [value as number, 'Pedidos']
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }}
                  formatter={(v) => v === 'total_ventas' ? 'Ingresos ($)' : 'Cantidad de pedidos'}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="total_ventas"
                  stroke={COLOR_VENTAS}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cantidad_pedidos"
                  stroke={COLOR_PEDIDOS}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  strokeDasharray="4 3"
                />
              </LineChart>
            </ResponsiveContainer>
          )
        )}
      </div>

      {/* ── Fila de 2 columnas: Top productos + Distribución por estado ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top productos (BarChart vertical) */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-medium text-slate-100 mb-4">Top productos por ingresos</h2>
          {loadTop ? <Skeleton /> : (
            topData.length === 0 ? (
              <EmptyChart mensaje="Sin ventas registradas" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topData} margin={{ top: 4, right: 8, left: 0, bottom: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis
                    dataKey="nombre"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={fmtCompacto}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  // @ts-ignore — recharts v3 Formatter type conflict
                    formatter={(value: any, name: string) =>
                      name === 'ingresos' ? [fmt(value), 'Ingresos'] : [value, 'Unidades vendidas']
                    }
                  />
                  <Bar dataKey="ingresos" fill={COLOR_BAR} radius={[4, 4, 0, 0]}>
                    {topData.map((_, i) => (
                      <Cell key={i} fill={COLOR_BAR} fillOpacity={0.85 - i * 0.07} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          )}
        </div>

        {/* Distribución por estado (PieChart) */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-medium text-slate-100 mb-4">Pedidos por estado</h2>
          {loadEstado ? <Skeleton /> : (
            estadoData.length === 0 ? (
              <EmptyChart mensaje="Sin pedidos registrados" />
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={estadoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {estadoData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  // @ts-ignore — recharts v3 Formatter type conflict
                      formatter={(v: any, _: string, props: any) =>
                        [`${v} pedidos`, props.payload.name]
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Leyenda manual */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-1">
                  {estadoData.map(e => (
                    <span key={e.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: e.color }} />
                      {e.name}
                      <span className="text-slate-500">({e.value})</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Ingresos por forma de pago (BarChart horizontal) ──────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-slate-100">Ingresos por forma de pago</h2>
          {ingresosData && (
            <span className="text-sm text-slate-400">
              Total: <span className="text-slate-200 font-medium">{fmt(Number(ingresosData.total_general))}</span>
            </span>
          )}
        </div>

        {loadIngresos ? <Skeleton h="h-40" /> : (
          pagosData.length === 0 ? (
            <EmptyChart h="h-32" mensaje="Sin pagos aprobados registrados" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(120, pagosData.length * 56)}>
              <BarChart
                data={pagosData}
                layout="vertical"
                margin={{ top: 4, right: 80, left: 10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={fmtCompacto}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  // @ts-ignore — recharts v3 Formatter type conflict
                  formatter={(value: any, name: string) =>
                    name === 'total'
                      ? [fmt(value), 'Ingresos']
                      : [value, 'Pedidos']
                  }
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {pagosData.map((_, i) => (
                    <Cell key={i} fill={COLORS_PAGO[i % COLORS_PAGO.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        )}
      </div>
    </div>
  )
}

// ── Estado vacío genérico ─────────────────────────────────────────────────────
function EmptyChart({ mensaje, h = 'h-64' }: { mensaje: string; h?: string }) {
  return (
    <div className={`${h} flex flex-col items-center justify-center text-slate-500 gap-2`}>
      <span className="text-3xl">📭</span>
      <span className="text-sm">{mensaje}</span>
    </div>
  )
}
