/**
 * useOrderStatusWS — conexión WebSocket de seguimiento de pedidos.
 *
 * - Auth por query param ?token=<jwt>.
 * - Con pedidoId  → se suscribe al canal de ESE pedido (cliente).
 * - Sin pedidoId  → feed "admin" de todos los pedidos (ADMIN/PEDIDOS).
 * - Reconexión exponencial (1s, 2s, 4s... tope 30s, hasta 10 intentos).
 * - Expone `connected` para mostrar el badge "Sin conexión en tiempo real".
 */
import { useEffect, useRef, useState } from 'react'

const WS_BASE = 'ws://localhost:8000/api/v1/pedidos/ws'
const MAX_INTENTOS = 10

interface Options {
  pedidoId?: number
  onEvent?: (msg: { event: string; data: Record<string, unknown> }) => void
  enabled?: boolean
}
import { useAuth } from '../store/authStore'

function getToken(): string | null {
  return useAuth.getState().user?.token ?? null
}

export function useOrderStatusWS({ pedidoId, onEvent, enabled = true }: Options = {}) {
  const [connected, setConnected] = useState(false)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled) return
    const token = getToken()
    if (!token) return

    let ws: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout>
    let intentos = 0
    let cerrado = false

    const buildUrl = () => {
      const q = new URLSearchParams({ token })
      if (pedidoId != null) q.set('pedido_id', String(pedidoId))
      return `${WS_BASE}?${q.toString()}`
    }

    const conectar = () => {
      ws = new WebSocket(buildUrl())

      ws.onopen = () => { intentos = 0; setConnected(true) }

      ws.onmessage = (e) => {
        try { onEventRef.current?.(JSON.parse(e.data)) } catch { /* ignore */ }
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