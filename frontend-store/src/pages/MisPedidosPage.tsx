import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pedidosApi } from '../api/index'
import { useAuth } from '../store/authStore'
import { useState } from 'react'
import { useEffect } from 'react'

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE:  '🕐 Pendiente',
  CONFIRMADO: '✓ Confirmado',
  EN_PREP:    '🍳 En preparación',
  ENTREGADO:  '✅ Entregado',
  CANCELADO:  '✗ Cancelado',
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE:  'bg-yellow-900/40 text-yellow-300',
  CONFIRMADO: 'bg-blue-900/40 text-blue-300',
  EN_PREP:    'bg-orange-900/40 text-orange-300',
  ENTREGADO:  'bg-green-900/40 text-green-300',
  CANCELADO:  'bg-red-900/40 text-red-300',
}

export default function MisPedidosPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [cancelandoId, setCancelandoId] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')

  if (!isAuthenticated()) {
    navigate('/login')
    return null
  }

  const { data: pedidos = [], isLoading, isError } = useQuery({
    queryKey: ['mis-pedidos'],
    queryFn: () => pedidosApi.getMisPedidos(),
    refetchInterval: 30000, // auto-refresh cada 30 seg
  })

  const cancelarMut = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      pedidosApi.cancelar(id, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-pedidos'] })
      setCancelandoId(null)
      setMotivo('')
    },
  })

  useEffect(() => {
    let ws: WebSocket
    let reconnectTimer: ReturnType<typeof setTimeout>
    let cerrado = false

    function conectar() {
      ws = new WebSocket('ws://localhost:8000/pedidos/cocina/ws')

      ws.onmessage = () => {
        queryClient.invalidateQueries({ queryKey: ['mis-pedidos'] })
      }

      ws.onclose = () => {
        if (!cerrado) reconnectTimer = setTimeout(conectar, 3000)
      }
    }

    conectar()

    return () => {
      cerrado = true
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [queryClient])

  const pedidosOrdenados = [...pedidos].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">📦 Mis pedidos</h1>

      {isLoading && <p className="text-gray-400 text-center py-12">Cargando pedidos...</p>}
      {isError && <p className="text-red-400 text-center py-12">Error al cargar los pedidos</p>}

      {!isLoading && pedidosOrdenados.length === 0 && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-gray-400 mb-6">Todavía no hiciste ningún pedido</p>
          <button onClick={() => navigate('/')} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium">
            Ver menú
          </button>
        </div>
      )}

      <div className="space-y-4">
        {pedidosOrdenados.map(pedido => (
          <div key={pedido.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold">Pedido #{pedido.id}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[pedido.estado_codigo]}`}>
                  {ESTADO_LABELS[pedido.estado_codigo]}
                </span>
              </div>
              <span className="text-gray-500 text-xs">
                {new Date(pedido.created_at).toLocaleString('es-AR')}
              </span>
            </div>

            {/* Detalles */}
            <div className="space-y-1 mb-3">
              {(pedido.detalles ?? []).map((d, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-300">{d.cantidad}x {d.nombre_snapshot}</span>
                  <span className="text-gray-400">${Number(d.subtotal_snap).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-gray-800 pt-3">
              <div className="text-sm text-gray-400">
                {pedido.forma_pago_codigo}
                {pedido.notas && <span className="ml-3">📝 {pedido.notas}</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-orange-400 font-bold">${Number(pedido.total).toFixed(2)}</span>
                {(pedido.estado_codigo === 'PENDIENTE' || pedido.estado_codigo === 'CONFIRMADO') && (
                  <button onClick={() => setCancelandoId(pedido.id)}
                    className="text-red-400 hover:text-red-300 text-xs border border-red-800 px-3 py-1 rounded-lg transition-colors">
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* Modal cancelar inline */}
            {cancelandoId === pedido.id && (
              <div className="mt-3 bg-gray-800 rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-300">¿Por qué querés cancelar este pedido?</p>
                <input
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                  placeholder="Motivo de cancelación..."
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setCancelandoId(null); setMotivo('') }}
                    className="text-gray-400 hover:text-white text-sm px-4 py-2">
                    Volver
                  </button>
                  <button
                    onClick={() => cancelarMut.mutate({ id: pedido.id, motivo })}
                    disabled={!motivo.trim() || cancelarMut.isPending}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                    {cancelarMut.isPending ? 'Cancelando...' : 'Confirmar cancelación'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}