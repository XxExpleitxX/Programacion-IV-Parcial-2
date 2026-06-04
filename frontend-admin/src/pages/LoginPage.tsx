import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    if (!username || !password) {
      setError('Por favor completá todos los campos')
      return
    }
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (e: any) {
      setError(e.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <h1 className="text-4xl font-bold text-slate-100 mb-10 text-center">
        Iniciar Sesión
      </h1>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          className="w-full px-4 py-3 rounded-full border border-border bg-card text-slate-200 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          className="w-full px-4 py-3 rounded-full border border-border bg-card text-slate-200 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-500"
        />

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 rounded-full bg-brand-600 text-white font-semibold hover:bg-brand-700 transition disabled:opacity-60"
        >
          {loading ? 'Ingresando...' : 'Login'}
        </button>
      </div>
    </div>
  )
}
