import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pedidosApi } from '../api'
import { useAuth } from '../context/AuthContext'
import type { Pedido, DetallePedido } from '../types'

// FSM — transiciones permitidas por estado
const TRANSICIONES: Record<string, string[]> = {
  PENDIENTE:  ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['EN_PREP',    'CANCELADO'],
  EN_PREP:    ['EN_CAMINO',  'CANCELADO'],
  EN_CAMINO:  ['ENTREGADO'],
  ENTREGADO:  [],
  CANCELADO:  [],
}

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE:  'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREP:    'En preparación',
  EN_CAMINO:  'En camino',
  ENTREGADO:  'Entregado',
  CANCELADO:  'Cancelado',
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE:  'bg-yellow-900/40 text-yellow-300',
  CONFIRMADO: 'bg-blue-900/40 text-blue-300',
  EN_PREP:    'bg-orange-900/40 text-orange-300',
  EN_CAMINO:  'bg-purple-900/40 text-purple-300',
  ENTREGADO:  'bg-green-900/40 text-green-300',
  CANCELADO:  'bg-red-900/40 text-red-300',
}

const BOTON_LABELS: Record<string, string> = {
  CONFIRMADO: '✓ Confirmar',
  EN_PREP:    '🍳 En preparación',
  EN_CAMINO:  '🚚 En camino',
  ENTREGADO:  '✅ Entregado',
  CANCELADO:  '✗ Cancelar',
}

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
          ¿Confirmar cambio de <span className="text-slate-200 font-medium">{ESTADO_LABELS[pedido.estado_codigo]}</span> a{' '}
          <span className="text-slate-200 font-medium">{ESTADO_LABELS[estadoHacia]}</span>?
        </p>

        {necesitaMotivo && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Motivo de cancelación *
            </label>
            <textarea
              className="input-field resize-none"
              rows={3}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ingresá el motivo..."
            />
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

export default function CajeroPedidosPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modalData, setModalData] = useState<{ pedido: Pedido; estadoHacia: string } | null>(null)

  const { data: pedidos = [], isLoading, isError } = useQuery({
    queryKey: ['pedidos-cajero', filtroEstado],
    queryFn: () => pedidosApi.getAll({ estado: filtroEstado || undefined }),
    refetchInterval: 30000, // auto-refresh cada 30 segundos
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

  const handleAvanzar = (motivo?: string) => {
    if (!modalData) return
    avanzarMut.mutate({
      id: modalData.pedido.id,
      estado: modalData.estadoHacia,
      motivo,
    })
  }

  // Ordenar por estado — primero los activos
  const ORDEN_ESTADOS = ['EN_PREP', 'CONFIRMADO', 'PENDIENTE', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO']
  const pedidosOrdenados = [...pedidos].sort(
    (a, b) => ORDEN_ESTADOS.indexOf(a.estado_codigo) - ORDEN_ESTADOS.indexOf(b.estado_codigo)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-slate-100">Panel Cajero</h1>
          <p className="text-slate-400 text-sm mt-1">
            Gestión de estados de pedidos — {user?.username}
          </p>
        </div>
        <select
          className="input-field max-w-xs"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-slate-400">Cargando pedidos...</p>}
      {isError && <p className="text-red-400">Error al cargar los pedidos.</p>}

      {!isLoading && !isError && (
        <div className="space-y-4">
          {pedidosOrdenados.length === 0 && (
            <div className="card text-center py-12 text-slate-500">
              No hay pedidos {filtroEstado ? `en estado ${ESTADO_LABELS[filtroEstado]}` : ''}
            </div>
          )}

          {pedidosOrdenados.map(pedido => {
            const transiciones = TRANSICIONES[pedido.estado_codigo] ?? []

            return (
              <div key={pedido.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-display text-lg text-slate-100">
                        Pedido #{pedido.id}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[pedido.estado_codigo]}`}>
                        {ESTADO_LABELS[pedido.estado_codigo]}
                      </span>
                      <span className="text-xs text-slate-500">
                        {pedido.forma_pago_codigo}
                      </span>
                    </div>

                    {/* Detalles del pedido */}
                    <div className="space-y-1 mb-3">
                      {(pedido.detalles ?? [] as DetallePedido[]).map((d: DetallePedido, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                          <span className="w-6 h-6 flex items-center justify-center bg-brand-900/50 text-brand-300 rounded text-xs font-bold">
                            {d.cantidad}
                          </span>
                          <span>{d.nombre_snapshot}</span>
                          <span className="text-slate-500 ml-auto">${Number(d.subtotal_snap).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Total: <span className="text-brand-400 font-medium">${Number(pedido.total).toFixed(2)}</span></span>
                      {pedido.notas && <span>📝 {pedido.notas}</span>}
                      <span>{new Date(pedido.created_at).toLocaleString('es-AR')}</span>
                    </div>
                  </div>

                  {/* Botones de transición */}
                  {transiciones.length > 0 && (
                    <div className="flex flex-col gap-2 min-w-[160px]">
                      {transiciones.map(estado => (
                        <button
                          key={estado}
                          onClick={() => setModalData({ pedido, estadoHacia: estado })}
                          className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                            estado === 'CANCELADO'
                              ? 'bg-red-900/40 text-red-300 hover:bg-red-900/70 border border-red-800/50'
                              : 'btn-primary'
                          }`}
                        >
                          {BOTON_LABELS[estado] ?? estado}
                        </button>
                      ))}
                    </div>
                  )}

                  {transiciones.length === 0 && (
                    <span className="text-xs text-slate-600 italic">Estado final</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalData && (
        <AvanzarModal
          pedido={modalData.pedido}
          estadoHacia={modalData.estadoHacia}
          onConfirm={handleAvanzar}
          onClose={() => setModalData(null)}
          isLoading={avanzarMut.isPending}
        />
      )}
    </div>
  )
}