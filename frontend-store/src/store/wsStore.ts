/**
 * wsStore — estado global de la conexión WebSocket de seguimiento de pedidos.
 *
 * Lo escriben SOLO los hooks de WS (useOrderStatusWS); los componentes lo leen
 * para mostrar el badge "Sin conexión en tiempo real" y el último evento recibido.
 */
import { create } from 'zustand'

export interface WSEvent {
  event: string
  data: Record<string, unknown>
}

interface WSState {
  connected: boolean
  lastEvent: WSEvent | null
  setConnected: (v: boolean) => void
  pushEvent: (e: WSEvent) => void
}

export const useWS = create<WSState>((set) => ({
  connected: false,
  lastEvent: null,
  setConnected: (connected) => set({ connected }),
  pushEvent: (lastEvent) => set({ lastEvent }),
}))
