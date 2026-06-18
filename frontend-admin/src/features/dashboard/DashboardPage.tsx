/**
 * DashboardPage — Panel de estadísticas (solo ADMIN).
 *
 * Gráficos (spec §11):
 *   1. AreaChart  → ventas por período (área con gradiente + línea de pedidos)
 *   2. BarChart   → top 5 productos por ingresos (horizontal)
 *   3. PieChart   → pedidos por estado (dona con total al centro + colores semánticos)
 *   4. BarChart   → ingresos por forma de pago (horizontal)
 *
 * KPI cards (4) con icono, indicador de tendencia y jerarquía visual.
 * TanStack Query con refetch cada 60 seg.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart, Area, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { estadisticasApi } from '../../shared/api'
import { labelEstado } from '../../shared/utils/estados'

// ── Colores semánticos por estado ─────────────────────────────────────────────
const COLORS_ESTADO: Record<string, string> = {
  PENDIENTE:  '#f59e0b', // ámbar — atención
  CONFIRMADO: '#3b82f6', // azul — en proceso
  EN_PREP:    '#8b5cf6', // violeta — en cocina
  ENTREGADO:  '#22c55e', // verde — éxito
  CANCELADO:  '#ef4444', // rojo — error
}
const COLORS_PAGO = ['#3b82f6', '#22c55e', '#8b5cf6']
const COLOR_VENTAS  = '#f97316'  // naranja de marca
const COLOR_PEDIDOS = '#22c55e'
const COLOR_BAR     = '#f97316'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const fmtCompacto = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`

function formatPeriodo(periodo: string, agrupacion: string): string {
  if (agrupacion === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(periodo)) {
    const d = new Date(periodo + 'T00:00:00')
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })
  }
  return periodo
}

// ── Tooltip del gráfico de ventas ──────────────────────────────────────────────
function TooltipVentas({ active, payload, agrupacion }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-200 font-medium mb-1 capitalize">{formatPeriodo(d.periodo, agrupacion)}</p>
      <p className="text-orange-400">{fmt(d.total_ventas)} en ventas</p>
      <p className="text-emerald-400">{d.cantidad_pedidos} pedidos</p>
    </div>
  )
}

// ── Indicador de tendencia (↑/↓ % vs ayer) ─────────────────────────────────────
function Tendencia({ pct }: { pct: number }) {
  const sube = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
      sube ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
    }`}>
      {sube ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
      <span className="font-normal text-[10px] opacity-70 ml-0.5">vs ayer</span>
    </span>
  )
}

// ── KPI card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, trend, destacado }: {
  label: string; value: string; sub?: string; icon: string
  trend?: number | null; destacado?: boolean
}) {
  return (
    <div className={`rounded-xl p-5 border transition-colors ${
      destacado
        ? 'border-orange-500/60 bg-orange-500/5 shadow-lg shadow-orange-500/10'
        : 'border-border bg-card'
    }`}>
      <div className="flex items-start justify-between">
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        <span className={`text-base w-8 h-8 flex items-center justify-center rounded-lg ${
          destacado ? 'bg-orange-500/20' : 'bg-slate-800'
        }`}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-100 mt-2">{value}</p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {trend != null && <Tendencia pct={trend} />}
        {sub && <span className="text-xs text-slate-500">{sub}</span>}
      </div>
    </div>
  )
}

// ── Skeleton de carga ───────────────────────────────────────────────────────────
function Skeleton({ h = 'h-64' }: { h?: string }) {
  return <div className={`${h} bg-card border border-border rounded-xl animate-pulse`} />
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const [agrupacion, setAgrupacion] = useState<'day' | 'week' | 'month'>('day')

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

  // Serie diaria fija para la tendencia "vs ayer" (independiente del toggle).
  const { data: ventasDiarias = [] } = useQuery({
    queryKey: ['estadisticas', 'ventas', 'day', 'kpi'],
    queryFn: () => estadisticasApi.ventas({ agrupacion: 'day' }),
    refetchInterval: 60_000,
  })

  const { data: productosTop = [], isLoading: loadTop } = useQuery({
    queryKey: ['estadisticas', 'productosTop'],
    queryFn: () => estadisticasApi.productosTop(5),
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

  // ── Transformaciones ──────────────────────────────────────────────────────
  const ventasData = ventas.map(v => ({
    ...v,
    total_ventas:     Number(v.total_ventas),
    cantidad_pedidos: Number(v.cantidad_pedidos),
    label: agrupacion === 'month'
      ? v.periodo.slice(0, 7)
      : agrupacion === 'week'
      ? v.periodo.replace(/^\d{4}-/, '')
      : v.periodo.slice(5),
  }))

  // Tendencia de ventas hoy vs ayer (últimos 2 días con datos).
  const serieDia = ventasDiarias.map(v => Number(v.total_ventas))
  let tendenciaHoy: number | null = null
  if (serieDia.length >= 2) {
    const hoy = serieDia[serieDia.length - 1]
    const ayer = serieDia[serieDia.length - 2]
    tendenciaHoy = ayer > 0 ? ((hoy - ayer) / ayer) * 100 : (hoy > 0 ? 100 : 0)
  }

  const topData = productosTop.slice(0, 5).map(p => ({
    nombre: p.nombre,
    ingresos: Number(p.ingresos),
    vendidos: p.cantidad_vendida,
  }))

  const estadoData = porEstado.map(e => ({
    name:  labelEstado(e.estado_codigo),
    value: e.cantidad,
    color: COLORS_ESTADO[e.estado_codigo] ?? '#888',
  }))
  const totalPedidos = estadoData.reduce((s, e) => s + e.value, 0)

  const pagosData = (ingresosData?.items ?? []).map(i => ({
    name:  i.forma_pago_codigo,
    total: Number(i.total),
    cant:  i.cantidad,
  }))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">📊 Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Métricas del negocio en tiempo real</p>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadResumen ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} h="h-28" />)
        ) : (
          <>
            <KpiCard
              label="Ventas hoy"
              value={fmt(Number(resumen?.ventas_hoy ?? 0))}
              icon="🛒"
              trend={tendenciaHoy}
              destacado
            />
            <KpiCard
              label="Ticket promedio"
              value={fmt(Number(resumen?.ticket_promedio ?? 0))}
              icon="🎫"
              sub="por pedido"
            />
            <KpiCard
              label="Pedidos activos"
              value={String(resumen?.pedidos_activos ?? 0)}
              icon="⏱️"
              sub="pend. + conf. + en prep."
            />
            <KpiCard
              label="Ventas este mes"
              value={fmt(Number(resumen?.ventas_mes ?? 0))}
              icon="📈"
              sub="mes corriente"
            />
          </>
        )}
      </div>

      {/* ── Ventas por período (AreaChart) ─────────────────────────────────── */}
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
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={ventasData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLOR_VENTAS} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLOR_VENTAS} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
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
                  width={32}
                />
                <Tooltip content={<TooltipVentas agrupacion={agrupacion} />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }}
                  formatter={(v) => v === 'total_ventas' ? 'Ingresos ($)' : 'Cantidad de pedidos'}
                />
                <Area
                  yAxisId="left"
                  type="linear"
                  dataKey="total_ventas"
                  stroke={COLOR_VENTAS}
                  strokeWidth={2.5}
                  fill="url(#gradVentas)"
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="linear"
                  dataKey="cantidad_pedidos"
                  stroke={COLOR_PEDIDOS}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  strokeDasharray="4 3"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )
        )}
      </div>

      {/* ── Fila: Top productos + Pedidos por estado ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top 5 productos (BarChart horizontal) */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-medium text-slate-100 mb-4">Top 5 productos por ingresos</h2>
          {loadTop ? <Skeleton /> : (
            topData.length === 0 ? (
              <EmptyChart mensaje="Sin ventas registradas" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topData} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
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
                    dataKey="nombre"
                    tick={{ fill: '#cbd5e1', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={130}
                  />
                  <Tooltip
                    cursor={{ fill: '#ffffff08' }}
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    itemStyle={{ color: '#fdba74' }}
                  // @ts-ignore — recharts v3 Formatter type conflict
                    formatter={(value: any, name: string) =>
                      name === 'ingresos' ? [fmt(value), 'Ingresos'] : [value, 'Unidades']
                    }
                  />
                  <Bar dataKey="ingresos" radius={[0, 4, 4, 0]}>
                    {topData.map((_, i) => (
                      <Cell key={i} fill={COLOR_BAR} fillOpacity={0.95 - i * 0.13} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          )}
        </div>

        {/* Pedidos por estado (dona con total al centro) */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-medium text-slate-100 mb-4">Pedidos por estado</h2>
          {loadEstado ? <Skeleton /> : (
            estadoData.length === 0 ? (
              <EmptyChart mensaje="Sin pedidos registrados" />
            ) : (
              <div className="flex items-center gap-5">
                {/* Dona con total al centro */}
                <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={estadoData}
                        cx="50%" cy="50%"
                        innerRadius={58} outerRadius={84}
                        paddingAngle={3} dataKey="value"
                      >
                        {estadoData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      // @ts-ignore — recharts v3 Formatter type conflict
                        formatter={(v: any, _: string, props: any) => [`${v} pedidos`, props.payload.name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-slate-100">{totalPedidos}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">pedidos</span>
                  </div>
                </div>
                {/* Lista limpia a la derecha */}
                <ul className="flex-1 space-y-2">
                  {estadoData.map(e => (
                    <li key={e.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: e.color }} />
                        {e.name}
                      </span>
                      <span className="text-slate-100 font-medium">
                        {e.value}
                        <span className="text-slate-500 text-xs ml-1">
                          ({totalPedidos ? Math.round((e.value / totalPedidos) * 100) : 0}%)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
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
              <BarChart data={pagosData} layout="vertical" margin={{ top: 4, right: 80, left: 10, bottom: 4 }}>
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
                  labelStyle={{ color: '#e2e8f0' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  // @ts-ignore — recharts v3 Formatter type conflict
                  formatter={(value: any, name: string) =>
                    name === 'total' ? [fmt(value), 'Ingresos'] : [value, 'Pedidos']
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
