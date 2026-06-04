import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/index'
import { useAuth } from '../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuth(s => s.setUser)
  const [modo, setModo] = useState<'inicio' | 'login' | 'register'>('inicio')
  const [form, setForm] = useState({ email: '', password: '', nombre: '', apellido: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Derivar username del email (antes del @)
  const usernameDeEmail = (email: string) => email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const username = usernameDeEmail(form.email)
      const { token, user } = await authApi.login(username, form.password)
      setUser({ username: user.username, token, roles: user.roles ?? [] })
      navigate('/')
    } catch {
      // Intentar con el email directamente como username
      try {
        const { token, user } = await authApi.login(form.email, form.password)
        setUser({ username: user.username, token, roles: user.roles ?? [] })
        navigate('/')
      } catch (err: any) {
        setError('Email o contraseña incorrectos')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const username = usernameDeEmail(form.email)
      await authApi.register({
        username,
        nombre: form.nombre || username,
        apellido: form.apellido || '',
        email: form.email,
        password: form.password,
      })
      const { token, user } = await authApi.login(username, form.password)
      setUser({ username: user.username, token, roles: user.roles ?? [] })
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Lado izquierdo — foto heroica ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&q=85"
          alt="comida deliciosa"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        <div className="relative z-10 p-12 flex flex-col justify-end pb-16">
          <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mb-6 shadow-lg">
            <span className="text-2xl">🍕</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-3">
            La mejor comida,<br />en minutos.
          </h2>
          <p className="text-gray-300 text-lg">
            Más de 50 platos preparados con ingredientes frescos,<br />
            directo a tu puerta.
          </p>
          <div className="flex gap-6 mt-8">
            {['🍕 Pizzas', '🍔 Burgers', '🍰 Postres', '🥗 Ensaladas'].map(item => (
              <span key={item} className="text-sm text-orange-300 font-medium">{item}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lado derecho — formulario ── */}
      <div className="flex-1 bg-[#111] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🍕</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Food Store</h1>
          </div>

          {/* ── Vista inicio ── */}
          {modo === 'inicio' && (
            <div className="space-y-5">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Bienvenido 👋</h1>
                <p className="text-gray-400">
                  Únete y pedí tu comida favorita en minutos.
                </p>
              </div>

              {/* Google */}
              <button
                onClick={() => alert('Google login próximamente')}
                className="w-full bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-md"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </button>

              {/* Separador */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-gray-600 text-sm">o</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {/* Registrarse */}
              <button
                onClick={() => setModo('register')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl transition-colors shadow-lg shadow-orange-500/20"
              >
                Crear cuenta y pedir →
              </button>

              {/* Login */}
              <p className="text-center text-gray-500 text-sm pt-2">
                ¿Ya tenés cuenta?{' '}
                <button onClick={() => setModo('login')} className="text-orange-400 hover:text-orange-300 font-semibold transition-colors">
                  Iniciá sesión
                </button>
              </p>
            </div>
          )}

          {/* ── Vista login ── */}
          {modo === 'login' && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Iniciá sesión</h1>
                <p className="text-gray-400 text-sm">Ingresá tu email y contraseña</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    className="w-full bg-[#1a1a1a] border border-gray-800 focus:border-orange-500 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none transition-colors"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="tu@email.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    className="w-full bg-[#1a1a1a] border border-gray-800 focus:border-orange-500 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none transition-colors"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    required
                  />
                </div>
                {error && (
                  <p className="text-red-400 text-sm bg-red-950 border border-red-900 px-4 py-3 rounded-xl">{error}</p>
                )}
                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl transition-colors mt-2 shadow-lg shadow-orange-500/20">
                  {loading ? 'Ingresando...' : 'Ingresar →'}
                </button>
              </form>
              <button onClick={() => setModo('inicio')} className="w-full text-gray-600 hover:text-gray-400 text-sm mt-4 transition-colors">
                ← Volver
              </button>
            </div>
          )}

          {/* ── Vista registro ── */}
          {modo === 'register' && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Crear cuenta</h1>
                <p className="text-gray-400 text-sm">Solo tu email y contraseña para empezar</p>
              </div>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    className="w-full bg-[#1a1a1a] border border-gray-800 focus:border-orange-500 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none transition-colors"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="tu@email.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    className="w-full bg-[#1a1a1a] border border-gray-800 focus:border-orange-500 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none transition-colors"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                    required
                  />
                </div>
                {error && (
                  <p className="text-red-400 text-sm bg-red-950 border border-red-900 px-4 py-3 rounded-xl">{error}</p>
                )}
                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl transition-colors shadow-lg shadow-orange-500/20">
                  {loading ? 'Creando cuenta...' : 'Crear cuenta y pedir →'}
                </button>
                <p className="text-center text-gray-600 text-xs">
                  Al registrarte aceptás los términos de uso
                </p>
              </form>
              <button onClick={() => setModo('inicio')} className="w-full text-gray-600 hover:text-gray-400 text-sm mt-4 transition-colors">
                ← Volver
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}