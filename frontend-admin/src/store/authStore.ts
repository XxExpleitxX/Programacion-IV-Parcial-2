
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Rol = 'ADMIN' | 'STOCK' | 'PEDIDOS' | 'CLIENT'

export interface AuthUser {
  username: string
  rol: Rol             // rol principal (el más alto)
  roles: Rol[]         // lista completa
  token: string        // access_token JWT (30 min)
  refresh_token?: string  // refresh token (7 días) — renueva el access en 401
}

interface AuthState {
  user: AuthUser | null

  // Acciones
  login:  (username: string, password: string) => Promise<void>
  logout: () => Promise<void>

  // Selectores derivados (no hace falta suscribirse a todo el store)
  isAuthenticated: () => boolean
  hasRole:         (role: Rol) => boolean
}

const API = 'http://localhost:8000/api/v1'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,

      // ── Login ─────────────────────────────────────────────────────────
      login: async (username, password) => {
        // 1. Obtener el token
        const resLogin = await fetch(`${API}/auth/login`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, password }),
        })
        if (!resLogin.ok) {
          const err = await resLogin.json()
          throw new Error(err.detail ?? 'Credenciales incorrectas')
        }
        const { access_token: token, refresh_token } = await resLogin.json()

        // 2. Obtener perfil del usuario
        const resMe = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        })
        if (!resMe.ok) throw new Error('No se pudo obtener el perfil')
        const me = await resMe.json()

        // 3. Determinar rol principal
        const roles: Rol[] = me.roles ?? []
        const rol: Rol = roles.includes('ADMIN')   ? 'ADMIN'
          : roles.includes('PEDIDOS') ? 'PEDIDOS'
          : roles.includes('STOCK')   ? 'STOCK'
          : 'CLIENT'

        set({ user: { username: me.username ?? me.email, rol, roles, token, refresh_token } })
      },

      // ── Logout ────────────────────────────────────────────────────────
      logout: async () => {
        const user = get().user
        if (user?.token) {
          await fetch(`${API}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
            credentials: 'include',
            body: JSON.stringify({ refresh_token: user.refresh_token ?? '' }),
          }).catch(() => {}) // silencioso si el servidor no responde
        }
        set({ user: null })
      },

      // ── Selectores ────────────────────────────────────────────────────
      isAuthenticated: () => get().user !== null,
      hasRole: (role) => get().user?.roles.includes(role) ?? false,
    }),
    {
      name: 'admin_auth',          // clave en localStorage
      partialize: (state) => ({ user: state.user }), // solo persistimos user, no las funciones
    }
  )
)
