/**
 * SeguimientoPedidoPage — seguimiento de UN pedido en tiempo real.
 *
 * - useOrderStatusWS({ pedidoId }) abre el WS del canal de ese pedido.
 * - Cada evento invalida las queries (pedido + historial) → la UI se actualiza
 *   sin recargar y el timeline crece solo.
 * - Resync (spec 9.6): cuando la conexión se restablece tras una caída, se
 *   refetchea el estado actual con GET /pedidos/{id} + /historial.
 * - Badge de conexión "En vivo / Sin conexión".
 */
import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { pedidosApi } from '../../shared/api/index'
import { useAuth } from '../../store/authStore'
import { useWS } from '../../store/wsStore'
import { useOrderStatusWS } from '../../shared/hooks/useOrderStatusWS'

const FLUJO = ['PENDIENTE', 'CONFIRMADO', 'EN_PREP', 'ENTREGADO'] as const

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', EN_PREP: 'En preparación',
  ENTREGADO: 'Entregado', CANCELADO: 'Cancelado',
}
const ESTADO_ICON: Record<string, string> = {
  PENDIENTE: '🕐', CONFIRMADO: '✓', EN_PREP: '🍳', ENTREGADO: '✅', CANCELADO: '✗',
}

export default function SeguimientoPedidoPage() {
  const { id } = useParams<{ id: string }>()
  const pedidoId = Number(id)
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const wsConectado = useWS(s => s.connected)
  const autenticado = isAuthenticated()
  const habilitado = autenticado && !Number.isNaN(pedidoId)

  // Redirección a login como efecto (sin cortar el orden de los hooks).
  useEffect(() => {
    if (!autenticado) navigate('/login')
  }, [autenticado, navigate])

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId] })
    queryClient.invalidateQueries({ queryKey: ['pedido-historial', pedidoId] })
  }

  // WS del canal de este pedido; cada evento refresca pedido + historial.
  useOrderStatusWS({ pedidoId, onEvent: invalidar, enabled: habilitado })

  // Resync al reconectar: cuando connected pasa de false → true, refetch (spec 9.6).
  const prevConn = useRef(wsConectado)
  useEffect(() => {
    if (wsConectado && !prevConn.current) invalidar()
    prevConn.current = wsConectado
  }, [wsConectado])

  const { data: pedido, isLoading, isError } = useQuery({
    queryKey: ['pedido', pedidoId],
    queryFn: () => pedidosApi.getById(pedidoId),
    enabled: habilitado,
  })

  const { data: historial = [] } = useQuery({
    queryKey: ['pedido-historial', pedidoId],
    queryFn: () => pedidosApi.getHistorial(pedidoId),
    enabled: habilitado,
  })

  if (!autenticado) return null
  if (isLoading) return <p className="text-gray-400 text-center py-20">Cargando pedido...</p>
  if (isError || !pedido) return (
    <div className="text-center py-20">
      <p className="text-red-400 mb-4">No se encontró el pedido</p>
      <button onClick={() => navigate('/mis-pedidos')} className="btn-secondary text-orange-400">← Mis pedidos</button>
    </div>
  )

  const cancelado = pedido.estado_codigo === 'CANCELADO'
  const pasoActual = FLUJO.indexOf(pedido.estado_codigo as typeof FLUJO[number])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/mis-pedidos')} className="text-gray-400 hover:text-white text-sm mb-6">
        ← Mis pedidos
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Pedido #{pedido.id}</h1>
        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            wsConectado ? 'bg-green-900/40 text-green-300' : 'bg-gray-800 text-gray-500'
          }`}
          title={wsConectado ? 'Actualizaciones al instante' : 'Reconectando…'}
        >
          <span className={`w-2 h-2 rounded-full ${wsConectado ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          {wsConectado ? 'En vivo' : 'Sin conexión'}
        </span>
      </div>

      {/* Stepper del flujo (salvo cancelado) */}
      {!cancelado ? (
        <div className="flex items-center justify-between mb-8">
          {FLUJO.map((estado, i) => {
            const hecho = i <= pasoActual
            return (
              <div key={estado} className="flex-1 flex flex-col items-center relative">
                {i > 0 && (
                  <div className={`absolute right-1/2 top-4 h-0.5 w-full -z-0 ${i <= pasoActual ? 'bg-orange-500' : 'bg-gray-700'}`} />
                )}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  hecho ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-500 border border-gray-700'
                }`}>
                  {ESTADO_ICON[estado]}
                </div>
                <span className={`text-[11px] mt-1.5 text-center ${hecho ? 'text-orange-300' : 'text-gray-500'}`}>
                  {ESTADO_LABELS[estado]}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mb-6 bg-red-900/20 border border-red-900 text-red-300 px-4 py-3 rounded-xl text-sm">
          ✗ Este pedido fue cancelado.
        </div>
      )}

      {/* Timeline del historial (audit trail append-only, en tiempo real) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <h2 className="text-white font-semibold mb-4">Seguimiento</h2>
        <ol className="relative border-l border-gray-700 ml-2 space-y-5">
          {historial.map((h) => (
            <li key={h.id} className="ml-5">
              <span className="absolute -left-[7px] w-3.5 h-3.5 rounded-full bg-orange-500 ring-4 ring-gray-900" />
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium">
                  {ESTADO_ICON[h.estado_hacia]} {ESTADO_LABELS[h.estado_hacia] ?? h.estado_hacia}
                </span>
                <time className="text-gray-500 text-xs">
                  {new Date(h.created_at).toLocaleString('es-AR')}
                </time>
              </div>
              {h.motivo && <p className="text-gray-400 text-xs mt-0.5">📝 {h.motivo}</p>}
            </li>
          ))}
        </ol>
      </div>

      {/* Resumen del pedido */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="space-y-1 mb-3">
          {(pedido.detalles ?? []).map((d, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-300">{d.cantidad}x {d.nombre_snapshot}</span>
              <span className="text-gray-400">${Number(d.subtotal_snap).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-bold text-white border-t border-gray-800 pt-3">
          <span>Total</span>
          <span className="text-orange-400">${Number(pedido.total).toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
