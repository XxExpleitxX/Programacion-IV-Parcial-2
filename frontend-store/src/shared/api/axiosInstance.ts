/**
 * Instancia de Axios del Store.
 * - Request: agrega el access token JWT automáticamente.
 * - Response: ante un 401 intenta renovar el access token con el refresh token
 *   (POST /auth/refresh) y reintenta la request original UNA vez. Si el refresh
 *   falla, recién ahí desloguea y manda al login.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuth } from '../../store/authStore'

const BASE_URL = 'http://localhost:8000'

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// ── Request — agrega token ────────────────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    const token = useAuth.getState().user?.token
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// ── Refresh single-flight: si llegan varios 401 a la vez, un solo refresh ──
let refreshPromise: Promise<string | null> | null = null

async function refrescarAccessToken(): Promise<string | null> {
  const user = useAuth.getState().user
  if (!user?.refresh_token) return null
  try {
    // axios "crudo" (no la instancia) para no recursar el interceptor.
    const res = await axios.post(
      `${BASE_URL}/api/v1/auth/refresh`,
      { refresh_token: user.refresh_token },
      { withCredentials: true },
    )
    const nuevoToken: string = res.data.access_token
    useAuth.getState().setUser({
      ...user,
      token: nuevoToken,
      refresh_token: res.data.refresh_token ?? user.refresh_token,
    })
    return nuevoToken
  } catch {
    return null
  }
}

function refreshUnaVez(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refrescarAccessToken().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

// ── Response — 401 → refresh + retry, o logout ────────────
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const esRefresh = original?.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && original && !original._retry && !esRefresh) {
      original._retry = true
      const nuevoToken = await refreshUnaVez()
      if (nuevoToken) {
        original.headers.Authorization = `Bearer ${nuevoToken}`
        return axiosInstance(original)          // reintento transparente
      }
      // El refresh falló → desloguear de verdad
      useAuth.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default axiosInstance
