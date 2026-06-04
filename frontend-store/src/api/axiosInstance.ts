/**
 * Instancia de Axios del Store.
 * Interceptor de request: agrega token JWT automáticamente.
 * Interceptor de response: redirige al login si recibe 401.
 */
import axios from 'axios'

const BASE_URL = 'http://localhost:8000'

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// ── Request — agrega token ────────────────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    const stored = localStorage.getItem('store_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const token = parsed?.state?.user?.token        
        if (token) config.headers.Authorization = `Bearer ${token}`
      } catch { /* token corrupto, ignorar */ }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response — maneja 401 ────────────────────────────────
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('store_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default axiosInstance
