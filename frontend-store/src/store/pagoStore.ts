import { create } from 'zustand'

export interface UltimoPago {
  pedido_id: number
  mp_status: string
  mp_status_detail: string | null
}

interface PagoState {
  ultimoPago: UltimoPago | null
  setUltimoPago: (p: UltimoPago | null) => void
}

export const usePago = create<PagoState>((set) => ({
  ultimoPago: null,
  setUltimoPago: (ultimoPago) => set({ ultimoPago }),
}))
