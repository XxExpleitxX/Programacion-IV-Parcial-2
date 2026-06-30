
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../../store/authStore'

const BASE_URL = 'http://localhost:8000/api/v1'

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// ── Interceptor REQUEST: agrega el token JWT ──────────────
axiosInstance.interceptors.request.use(
  (config) => {
    // getState() funciona fuera de React (sin hooks)
    const token = useAuthStore.getState().user?.token
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// ── Refresh single-flight: un solo refresh aunque lleguen varios 401 ──
let refreshPromise: Promise<string | null> | null = null

async function refrescarAccessToken(): Promise<string | null> {
  const user = useAuthStore.getState().user
  if (!user?.refresh_token) return null
  try {
    const res = await axios.post(
      `${BASE_URL}/auth/refresh`,
      { refresh_token: user.refresh_token },
      { withCredentials: true },
    )
    const nuevoToken: string = res.data.access_token
    useAuthStore.setState({
      user: { ...user, token: nuevoToken, refresh_token: res.data.refresh_token ?? user.refresh_token },
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

// ── Interceptor RESPONSE: 401 → refresh + retry, o logout ───────
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
        return axiosInstance(original)
      }
      useAuthStore.setState({ user: null })
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default axiosInstance
