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
