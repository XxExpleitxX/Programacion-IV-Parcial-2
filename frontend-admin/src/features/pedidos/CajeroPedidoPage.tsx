import { useState, useEffect, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pedidosApi, productosApi } from '../../shared/api'
import type { Pedido, DetallePedido, Producto } from '../../shared/types'
import { useAuthStore } from '../../store/authStore'
import { useOrderStatusWS } from '../../shared/hooks/useOrderStatusWS'

// ── FSM ───────────────────────────────────────────────────────────────────

const TRANSICIONES: Record<string, string[]> = {
  PENDIENTE:  ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['EN_PREP',    'CANCELADO'],
  EN_PREP:    ['ENTREGADO',  'CANCELADO'],
  ENTREGADO:  [],
  CANCELADO:  [],
}

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE:  'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREP:    'En preparación',
  ENTREGADO:  'Entregado',
  CANCELADO:  'Cancelado',
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE:  'bg-yellow-900/40 text-yellow-300',
  CONFIRMADO: 'bg-blue-900/40 text-blue-300',
  EN_PREP:    'bg-orange-900/40 text-orange-300',
  ENTREGADO:  'bg-green-900/40 text-green-300',
  CANCELADO:  'bg-red-900/40 text-red-300',
}

const BOTON_LABELS: Record<string, string> = {
  CONFIRMADO: '✓ Confirmar',
  EN_PREP:    '🍳 En preparación',
  ENTREGADO:  '✅ Entregado',
  CANCELADO:  '✗ Cancelar',
}

// ── Tiempo transcurrido ─────────────────────────────────────────────────────

// El backend guarda created_at con utcnow() (sin zona); lo interpretamos como UTC.
function parseUTC(s: string): Date {
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + 'Z')
}

function tiempoDesde(createdAt: string, now: number): { texto: string; alerta: boolean } {
  const min = Math.max(0, Math.floor((now - parseUTC(createdAt).getTime()) / 60000))
  if (min < 1) return { texto: 'Recién', alerta: false }
  if (min < 60) return { texto: `Hace ${min} min`, alerta: min >= 30 }
  const h = Math.floor(min / 60)
  return { texto: `Hace ${h} h ${min % 60} min`, alerta: true }
}

// Reloj compartido: re-renderiza cada 30s para refrescar los "Hace X min".
function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// ── Timeline de estados ─────────────────────────────────────────────────────

const PASOS = [
  { codigo: 'PENDIENTE',  label: 'Recibido',   icon: '📥' },
  { codigo: 'CONFIRMADO', label: 'Confirmado', icon: '✓' },
  { codigo: 'EN_PREP',    label: 'En cocina',  icon: '🍳' },
  { codigo: 'ENTREGADO',  label: 'Entregado',  icon: '✅' },
]

function Timeline({ estado }: { estado: string }) {
  if (estado === 'CANCELADO') {
    return <div className="text-xs text-red-400 my-2">✗ Pedido cancelado</div>
  }
  const idx = PASOS.findIndex(p => p.codigo === estado)
  return (
    <div className="flex items-center my-3">
      {PASOS.map((p, i) => (
        <Fragment key={p.codigo}>
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
              i <= idx ? 'bg-brand-600 text-white' : 'bg-surface text-slate-600 border border-border'
            }`}>
              {i < idx ? '✓' : p.icon}
            </div>
            <span className={`text-[10px] mt-0.5 ${i <= idx ? 'text-slate-300' : 'text-slate-600'}`}>{p.label}</span>
          </div>
          {i < PASOS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < idx ? 'bg-brand-600' : 'bg-border'}`} />
          )}
        </Fragment>
      ))}
    </div>
  )
}

// ── Tarjeta de pedido ───────────────────────────────────────────────────────

interface PedidoCardProps {
  pedido: Pedido
  now: number
  onAvanzar: (estadoHacia: string) => void
  compact?: boolean
  draggable?: boolean
  onDragStart?: () => void
}

function PedidoCard({ pedido, now, onAvanzar, compact, draggable, onDragStart }: PedidoCardProps) {
  const { texto, alerta } = tiempoDesde(pedido.created_at, now)
  const transiciones = TRANSICIONES[pedido.estado_codigo] ?? []
  const enPrep = pedido.estado_codigo === 'EN_PREP'

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={`bg-surface border border-border rounded-xl p-4 transition-all shadow-lg hover:border-brand-500/50 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {}
      <div className="flex justify-between items-start mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-100 text-lg">Pedido #{pedido.id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLORS[pedido.estado_codigo]} ${enPrep ? 'animate-pulse' : ''}`}>
              {ESTADO_LABELS[pedido.estado_codigo]}
            </span>
          </div>
          <span className={`text-xs ${alerta ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
            ⏱ {texto} • {pedido.forma_pago_codigo}
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold text-brand-400 text-lg">${Number(pedido.total).toFixed(2)}</div>
        </div>
      </div>

      {!compact && <Timeline estado={pedido.estado_codigo} />}

      {}
      <div className="bg-card/60 rounded-lg p-3 mb-3 space-y-1.5">
        {(pedido.detalles ?? []).map((d: DetallePedido, i: number) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-slate-300">{d.cantidad}x {d.nombre_snapshot}</span>
            <span className="text-slate-400">${Number(d.subtotal_snap).toFixed(2)}</span>
          </div>
        ))}
        {pedido.notas && <div className="text-xs text-slate-500 pt-1 border-t border-border">📝 {pedido.notas}</div>}
      </div>

      {}
      {transiciones.length > 0 ? (
        <div className={`grid gap-2 ${transiciones.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {transiciones.map(estado => (
            <button key={estado} onClick={() => onAvanzar(estado)}
              className={`font-medium py-2 rounded-lg flex items-center justify-center gap-1 text-sm transition-colors ${
                estado === 'CANCELADO'
                  ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}>
              {BOTON_LABELS[estado] ?? estado}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600 italic text-center">Estado final</p>
      )}
    </div>
  )
}

// ── Tablero Kanban ──────────────────────────────────────────────────────────

const COLUMNAS_KANBAN = ['PENDIENTE', 'CONFIRMADO', 'EN_PREP', 'ENTREGADO', 'CANCELADO']

interface KanbanProps {
  pedidos: Pedido[]
  now: number
  onAvanzar: (pedido: Pedido, estadoHacia: string) => void
}

function KanbanBoard({ pedidos, now, onAvanzar }: KanbanProps) {
  const [dragId, setDragId] = useState<number | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  const soltar = (estadoDestino: string) => {
    setOverCol(null)
    const pedido = pedidos.find(p => p.id === dragId)
    setDragId(null)
    if (!pedido || pedido.estado_codigo === estadoDestino) return
    // Solo dispara si es una transición válida del FSM.
    if ((TRANSICIONES[pedido.estado_codigo] ?? []).includes(estadoDestino)) {
      onAvanzar(pedido, estadoDestino)
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNAS_KANBAN.map(col => {
        const dePedidos = pedidos.filter(p => p.estado_codigo === col)
        const esDestinoValido = dragId != null &&
          (TRANSICIONES[pedidos.find(p => p.id === dragId)?.estado_codigo ?? ''] ?? []).includes(col)
        return (
          <div key={col}
            onDragOver={e => { e.preventDefault(); setOverCol(col) }}
            onDragLeave={() => setOverCol(c => c === col ? null : c)}
            onDrop={() => soltar(col)}
            className={`flex-1 min-w-[260px] rounded-xl p-2 transition-colors ${
              overCol === col && esDestinoValido ? 'bg-brand-900/20 ring-2 ring-brand-500'
                : overCol === col ? 'bg-red-900/10 ring-2 ring-red-800/50' : 'bg-card/40'
            }`}>
            <div className="flex items-center justify-between px-2 py-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_COLORS[col]}`}>
                {ESTADO_LABELS[col]}
              </span>
              <span className="text-xs text-slate-500">{dePedidos.length}</span>
            </div>
            <div className="space-y-2 min-h-[60px]">
              {dePedidos.map(p => (
                <PedidoCard key={p.id} pedido={p} now={now} compact draggable
                  onDragStart={() => setDragId(p.id)}
                  onAvanzar={estado => onAvanzar(p, estado)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Modal avanzar estado ──────────────────────────────────────────────────

interface AvanzarModalProps {
  pedido: Pedido
  estadoHacia: string
  onConfirm: (motivo?: string) => void
  onClose: () => void
  isLoading: boolean
}

function AvanzarModal({ pedido, estadoHacia, onConfirm, onClose, isLoading }: AvanzarModalProps) {
  const [motivo, setMotivo] = useState('')
  const necesitaMotivo = estadoHacia === 'CANCELADO'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
        <h3 className="font-display text-lg text-slate-100 mb-4">
          Cambiar estado — Pedido #{pedido.id}
        </h3>
        <p className="text-slate-400 mb-4">
          ¿Confirmar cambio de{' '}
          <span className="text-slate-200 font-medium">{ESTADO_LABELS[pedido.estado_codigo]}</span>
          {' '}a{' '}
          <span className="text-slate-200 font-medium">{ESTADO_LABELS[estadoHacia]}</span>?
        </p>
        {necesitaMotivo && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-400 mb-1">Motivo *</label>
            <textarea className="input-field resize-none" rows={3} value={motivo}
              onChange={e => setMotivo(e.target.value)} placeholder="Ingresá el motivo..." />
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => onConfirm(necesitaMotivo ? motivo : undefined)}
            disabled={isLoading || (necesitaMotivo && !motivo.trim())}
            className={`btn-primary ${estadoHacia === 'CANCELADO' ? 'bg-red-600 hover:bg-red-700' : ''}`}
          >
            {isLoading ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Nuevo pedido ──────────────────────────────────────────────────────────

interface ItemCarrito {
  producto: Producto
  cantidad: number
}

function NuevoPedidoPanel({ onPedidoCreado }: { onPedidoCreado: () => void }) {
  const [items, setItems] = useState<ItemCarrito[]>([])
  const [formaPago, setFormaPago] = useState('EFECTIVO')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expandido, setExpandido] = useState(false)

  const { data: productos = [] } = useQuery({
    queryKey: ['productos', undefined, undefined, undefined],
    queryFn: () => productosApi.getAll({ disponible: true }),
  })

  const crearMut = useMutation({
    mutationFn: () => pedidosApi.crear({
      forma_pago_codigo: formaPago,
      notas: notas.trim() || undefined,
      items: items.map(i => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
    }),
    onSuccess: () => {
      setItems([])
      setNotas('')
      setFormaPago('EFECTIVO')
      setError(null)
      setExpandido(false)
      onPedidoCreado()
    },
    onError: (err: Error) => setError(err.message),
  })

  const agregarProducto = (producto: Producto) => {
    setItems(prev => {
      const existe = prev.find(i => i.producto.id === producto.id)
      if (existe) return prev.map(i => i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { producto, cantidad: 1 }]
    })
  }

  const cambiarCantidad = (productoId: number, cantidad: number) => {
    if (cantidad <= 0) {
      setItems(prev => prev.filter(i => i.producto.id !== productoId))
    } else {
      setItems(prev => prev.map(i => i.producto.id === productoId ? { ...i, cantidad } : i))
    }
  }

  const total = items.reduce((sum, i) => sum + i.producto.precio_base * i.cantidad, 0)

  return (
    <div className="card mb-6">
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h2 className="font-display text-xl text-slate-100">+ Nuevo pedido</h2>
          <p className="text-slate-400 text-sm">Crear pedido en mostrador</p>
        </div>
        <span className="text-slate-400 text-2xl">{expandido ? '▲' : '▼'}</span>
      </button>

      {expandido && (
        <div className="mt-6 space-y-5">
          {}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Productos disponibles</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {productos.map(p => (
                <button key={p.id} onClick={() => agregarProducto(p)}
                  className="text-left p-3 rounded-lg border border-border hover:border-brand-600 hover:bg-brand-900/20 transition-colors">
                  <div className="text-sm font-medium text-slate-200 truncate">{p.nombre}</div>
                  <div className="text-brand-400 text-xs font-bold">${p.precio_base.toFixed(2)}</div>
                </button>
              ))}
            </div>
          </div>

          {}
          {items.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Pedido</label>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.producto.id} className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2">
                    <span className="flex-1 text-sm text-slate-200">{item.producto.nombre}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => cambiarCantidad(item.producto.id, item.cantidad - 1)}
                        className="w-7 h-7 rounded bg-card text-slate-300 hover:bg-border flex items-center justify-center font-bold">−</button>
                      <span className="w-8 text-center text-slate-100 font-medium">{item.cantidad}</span>
                      <button onClick={() => cambiarCantidad(item.producto.id, item.cantidad + 1)}
                        className="w-7 h-7 rounded bg-card text-slate-300 hover:bg-border flex items-center justify-center font-bold">+</button>
                    </div>
                    <span className="text-brand-400 text-sm font-medium w-20 text-right">
                      ${(item.producto.precio_base * item.cantidad).toFixed(2)}
                    </span>
                    <button onClick={() => cambiarCantidad(item.producto.id, 0)}
                      className="text-red-400 hover:text-red-300 text-xs">✕</button>
                  </div>
                ))}
                <div className="flex justify-end text-base font-bold pt-1 border-t border-border">
                  <span className="text-slate-400 mr-3">Total:</span>
                  <span className="text-brand-400">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Forma de pago</label>
              <select className="input-field" value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="MERCADOPAGO">MercadoPago</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Notas</label>
              <input className="input-field" placeholder="Sin cebolla, extra queso..."
                value={notas} onChange={e => setNotas(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

          <button
            onClick={() => crearMut.mutate()}
            disabled={items.length === 0 || crearMut.isPending}
            className="btn-primary w-full py-3 text-base"
          >
            {crearMut.isPending ? 'Creando pedido...' : `Crear pedido — $${total.toFixed(2)}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────

export default function CajeroPedidosPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modalData, setModalData] = useState<{ pedido: Pedido; estadoHacia: string } | null>(null)
  const [vista, setVista] = useState<'lista' | 'kanban'>('lista')
  const now = useNow()

  const { data: pedidos = [], isLoading, isError } = useQuery({
    queryKey: ['pedidos-cajero', filtroEstado],
    queryFn: () => pedidosApi.getAll({ estado: filtroEstado || undefined }),
    refetchInterval: 30000,
  })

  const avanzarMut = useMutation({
    mutationFn: ({ id, estado, motivo }: { id: number; estado: string; motivo?: string }) =>
      pedidosApi.avanzarEstado(id, estado, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-cajero'] })
      setModalData(null)
    },
    onError: (err: Error) => alert(err.message),
  })

  // ── WebSocket: feed admin de todos los pedidos (hook con reconexión) ──
  const { connected } = useOrderStatusWS({
    onEvent: () => queryClient.invalidateQueries({ queryKey: ['pedidos-cajero'] }),
  })

  const ORDEN_ESTADOS = ['EN_PREP', 'CONFIRMADO', 'PENDIENTE', 'ENTREGADO', 'CANCELADO']
  const pedidosOrdenados = [...pedidos].sort(
    (a, b) => ORDEN_ESTADOS.indexOf(a.estado_codigo) - ORDEN_ESTADOS.indexOf(b.estado_codigo)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-slate-100">Panel Cajero</h1>
          <p className="text-slate-400 text-sm mt-1">Gestión de pedidos — {user?.username}</p>
          {!connected && (
            <span className="inline-block mt-2 text-xs px-2 py-1 rounded bg-red-900/40 text-red-300">
              ⚠ Sin conexión en tiempo real
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
            {(['lista', 'kanban'] as const).map(v => (
              <button key={v} onClick={() => setVista(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  vista === v ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}>
                {v === 'lista' ? '☰ Lista' : '▦ Tablero'}
              </button>
            ))}
          </div>
          <select className="input-field max-w-xs" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {}
      <NuevoPedidoPanel onPedidoCreado={() => queryClient.invalidateQueries({ queryKey: ['pedidos-cajero'] })} />

      {}
      {isLoading && <p className="text-slate-400">Cargando pedidos...</p>}
      {isError && <p className="text-red-400">Error al cargar los pedidos.</p>}

      {!isLoading && !isError && pedidosOrdenados.length === 0 && (
        <div className="card text-center py-12 text-slate-500">
          No hay pedidos {filtroEstado ? `en estado ${ESTADO_LABELS[filtroEstado]}` : ''}
        </div>
      )}

      {!isLoading && !isError && pedidosOrdenados.length > 0 && (
        vista === 'lista' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {pedidosOrdenados.map(pedido => (
              <PedidoCard
                key={pedido.id}
                pedido={pedido}
                now={now}
                onAvanzar={estado => setModalData({ pedido, estadoHacia: estado })}
              />
            ))}
          </div>
        ) : (
          <KanbanBoard
            pedidos={pedidos}
            now={now}
            onAvanzar={(pedido, estado) => setModalData({ pedido, estadoHacia: estado })}
          />
        )
      )}

      {modalData && (
        <AvanzarModal
          pedido={modalData.pedido}
          estadoHacia={modalData.estadoHacia}
          onConfirm={(motivo) => avanzarMut.mutate({ id: modalData.pedido.id, estado: modalData.estadoHacia, motivo })}
          onClose={() => setModalData(null)}
          isLoading={avanzarMut.isPending}
        />
      )}
    </div>
  )
}