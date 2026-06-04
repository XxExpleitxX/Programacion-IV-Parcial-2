import { createContext, useContext, useState, ReactNode } from 'react'

// El nuevo backend usa roles como lista: ["ADMIN", "STOCK", ...]
// El frontend solo necesita saber si es ADMIN o no para las rutas privadas
type Rol = 'ADMIN' | 'STOCK' | 'PEDIDOS' | 'CLIENT'

interface AuthUser {
  username: string
  rol: Rol        // primer rol del usuario (para compatibilidad con PrivateRoute)
  roles: Rol[]    // todos los roles
  token: string   // access_token para header Authorization
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  role: Rol | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('auth_user')
    return stored ? JSON.parse(stored) : null
  })

  const login = async (username: string, password: string) => {
    // 1. Login — obtiene el token (también setea cookie HttpOnly)
    const resLogin = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',   // necesario para recibir la cookie
      body: JSON.stringify({ username, password }),
    })
    if (!resLogin.ok) {
      const err = await resLogin.json()
      throw new Error(err.detail || 'Error al iniciar sesión')
    }
    const loginData = await resLogin.json()
    const token: string = loginData.access_token

    // 2. /me — obtiene los datos del usuario con el token
    const resMe = await fetch('http://localhost:8000/auth/me', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    })
    if (!resMe.ok) {
      throw new Error('No se pudo obtener el perfil del usuario')
    }
    const me = await resMe.json()

    // roles es una lista, tomamos el primero como rol principal
    const roles: Rol[] = me.roles ?? []
    const rolPrincipal: Rol = roles.includes('ADMIN') ? 'ADMIN'
      : roles[0] ?? 'CLIENT'

    const authUser: AuthUser = {
      username: me.username,
      rol: rolPrincipal,
      roles,
      token,
    }
    setUser(authUser)
    localStorage.setItem('auth_user', JSON.stringify(authUser))
  }

  const logout = async () => {
    await fetch('http://localhost:8000/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
    setUser(null)
    localStorage.removeItem('auth_user')
  }

  return (
    <AuthContext.Provider value={{
      user,
      token: user?.token ?? null,
      role: user?.rol ?? null,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}