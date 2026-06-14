/**
 * pagoStore — estado del proceso de pago con MercadoPago.
 *
 * Guarda el resultado del último pago para que la pantalla de seguimiento
 * pueda mostrar feedback ("pago aprobado / rechazado") tras volver del checkout.
 */
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
