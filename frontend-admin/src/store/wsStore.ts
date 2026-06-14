/**
 * wsStore — estado de la conexión WebSocket del panel admin.
 *
 * Lo escriben SOLO los hooks de WS (useOrderStatusWS).
 * Los componentes lo leen para mostrar el badge de conexión
 * y el último evento recibido.
 *
 * NO persiste (estado efímero de conexión de red).
 */

import { create } from 'zustand'

export interface WSEvent {
  event: string
  data:  Record<string, unknown>
}

interface WSState {
  connected: boolean
  lastEvent: WSEvent | null

  // Acciones (solo los hooks WS las llaman)
  setConnected: (v: boolean) => void
  pushEvent:    (e: WSEvent) => void
  reset:        () => void
}

export const useWSStore = create<WSState>((set) => ({
  connected: false,
  lastEvent: null,

  setConnected: (connected) => set({ connected }),
  pushEvent:    (lastEvent)  => set({ lastEvent }),
  reset:        ()           => set({ connected: false, lastEvent: null }),
}))
