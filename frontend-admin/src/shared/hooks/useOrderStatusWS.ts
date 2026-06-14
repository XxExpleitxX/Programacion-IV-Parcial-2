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
  try {
    const raw = localStorage.getItem('admin_auth')
    return raw ? (JSON.parse(raw)?.state?.user?.token ?? null) : null
  } catch {
    return null
  }
}

/** Renueva el access token con el refresh token persistido (spec 9.6). Best-effort. */
async function refrescarToken(): Promise<void> {
  try {
    const raw = localStorage.getItem('admin_auth')
    const parsed = raw ? JSON.parse(raw) : null
    const refresh = parsed?.state?.user?.refresh_token
    if (!refresh) return
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) return
    const data = await res.json()
    parsed.state.user = {
      ...parsed.state.user,
      token: data.access_token,
      refresh_token: data.refresh_token ?? refresh,
    }
    localStorage.setItem('admin_auth', JSON.stringify(parsed))
  } catch { /* si falla, el backoff reintenta igual */ }
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
        try { onEventRef.current?.(JSON.parse(e.data)) } catch { /* ignore */ }
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

/** Componente invisible: abre un WS para UN pedido y avisa cambios. Útil en listas. */
export function PedidoWSListener({ pedidoId, onChange }: { pedidoId: number; onChange: () => void }) {
  useOrderStatusWS({ pedidoId, onEvent: onChange })
  return null
}