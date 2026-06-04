/**
 * Estado de autenticación del Store.
 * Persiste en localStorage con clave 'store_user'.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '../types/index'

interface AuthState {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,

      setUser: (user) => set({ user }),

      logout: () => set({ user: null }),

      isAuthenticated: () => get().user !== null,
    }),
    {
      name: 'store_user',
    }
  )
)
