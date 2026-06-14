/**
 * useOrderStatusWS — conexión WebSocket de seguimiento de pedidos.
 *
 * - Auth por query param ?token=<jwt>.
 * - Con pedidoId  → se suscribe al canal de ESE pedido (cliente).
 * - Sin pedidoId  → feed "admin" de todos los pedidos (ADMIN/PEDIDOS).
 * - Reconexión exponencial (1s, 2s, 4s... tope 30s, hasta 10 intentos).
 * - El estado de conexión y el último evento viven en wsStore (Zustand).
 * - Cada evento dispara un toast (uiStore).
 */
import { useEffect, useRef } from 'react'
import { useAuth } from '../../store/authStore'
import { useWS } from '../../store/wsStore'
import { useUI } from '../../store/uiStore'

const WS_ROOT = 'ws://localhost:8000/api/v1/ws'
const MAX_INTENTOS = 10

interface Options {
  pedidoId?: number
  onEvent?: (msg: { event: string; data: Record<string, unknown> }) => void
  enabled?: boolean
}

function getToken(): string | null {
  return useAuth.getState().user?.token ?? null
}

export function useOrderStatusWS({ pedidoId, onEvent, enabled = true }: Options = {}) {
  const connected = useWS((s) => s.connected)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled) return
    const token = getToken()
    if (!token) return

    const { setConnected, pushEvent } = useWS.getState()
    const { addToast } = useUI.getState()

    let ws: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout>
    let intentos = 0
    let cerrado = false

    const buildUrl = () => {
      const q = new URLSearchParams({ token })
      // Ruta nombrada: canal del pedido o feed admin.
      const path = pedidoId != null ? `/pedidos/${pedidoId}` : '/admin/pedidos'
      return `${WS_ROOT}${path}?${q.toString()}`
    }

    const conectar = () => {
      ws = new WebSocket(buildUrl())

      ws.onopen = () => { intentos = 0; setConnected(true) }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          pushEvent(msg)
          const estado = msg?.data?.estado_nuevo
          if (estado) addToast(`Pedido actualizado: ${estado}`, 'info')
          onEventRef.current?.(msg)
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        setConnected(false)
        if (cerrado || intentos >= MAX_INTENTOS) return
        const delay = Math.min(1000 * 2 ** intentos, 30000) // backoff exponencial
        intentos++
        timer = setTimeout(conectar, delay)
      }

      ws.onerror = () => ws?.close()
    }

    conectar()
    return () => { cerrado = true; clearTimeout(timer); ws?.close() }
  }, [pedidoId, enabled])

  return { connected }
}

/** Componente invisible: abre un WS para UN pedido y avisa cambios. Útil en listas. */
export function PedidoWSListener({ pedidoId, onChange }: { pedidoId: number; onChange: () => void }) {
  useOrderStatusWS({ pedidoId, onEvent: onChange })
  return null
}
