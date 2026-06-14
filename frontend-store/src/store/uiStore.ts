/**
 * uiStore — estado de UI local: notificaciones (toasts).
 *
 * Cualquier parte de la app puede disparar un toast con addToast(); el
 * componente <Toasts/> los renderiza y se autodescartan.
 */
import { create } from 'zustand'

export type ToastTipo = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tipo: ToastTipo
  mensaje: string
}

interface UIState {
  toasts: Toast[]
  addToast: (mensaje: string, tipo?: ToastTipo) => void
  removeToast: (id: number) => void
}

let _id = 0

export const useUI = create<UIState>((set) => ({
  toasts: [],
  addToast: (mensaje, tipo = 'info') => {
    const id = ++_id
    set((s) => ({ toasts: [...s.toasts, { id, tipo, mensaje }] }))
    // autodescarte a los 3s
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
