import { useEffect, useRef } from 'react'
import { useAuth } from '../../store/authStore'
import { useWS } from '../../store/wsStore'
import { useUI } from '../../store/uiStore'
import { labelEstado } from '../lib/estados'

const WS_ROOT = 'ws://localhost:8000/api/v1/ws'
const API_BASE = 'http://localhost:8000/api/v1'
const MAX_INTENTOS = 10
const WS_TOKEN_EXPIRADO = 4001   // close code que envía el backend si el JWT expiró

interface Options {
  pedidoId?: number
  onEvent?: (msg: { event: string; data: Record<string, unknown> }) => void
  enabled?: boolean
}

function getToken(): string | null {
  return useAuth.getState().user?.token ?? null
}

async function refrescarToken(): Promise<void> {
  const { user, setUser } = useAuth.getState()
  if (!user?.refresh_token) return
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refresh_token: user.refresh_token }),
    })
    if (!res.ok) return
    const data = await res.json()
    setUser({ ...user, token: data.access_token, refresh_token: data.refresh_token ?? user.refresh_token })
  } catch {  }
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
      // Lee el token fresco en cada (re)conexión, así toma el renovado tras un 4001.
      const q = new URLSearchParams({ token: getToken() ?? '' })
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
          if (estado) addToast(`Pedido actualizado: ${labelEstado(String(estado))}`, 'info')
          onEventRef.current?.(msg)
        } catch {  }
      }

      ws.onclose = (ev) => {
        setConnected(false)
        if (cerrado || intentos >= MAX_INTENTOS) return
        const reconectar = () => {
          const delay = Math.min(1000 * 2 ** intentos, 30000) // backoff exponencial
          intentos++
          timer = setTimeout(conectar, delay)
        }
        // Token expirado → refrescar primero y luego reconectar (spec 9.6).
        if (ev.code === WS_TOKEN_EXPIRADO) {
          refrescarToken().finally(reconectar)
        } else {
          reconectar()
        }
      }

      ws.onerror = () => ws?.close()
    }

    conectar()
    return () => { cerrado = true; clearTimeout(timer); ws?.close() }
  }, [pedidoId, enabled])

  return { connected }
}

export function PedidoWSListener({ pedidoId, onChange }: { pedidoId: number; onChange: () => void }) {
  useOrderStatusWS({ pedidoId, onEvent: onChange })
  return null
}
