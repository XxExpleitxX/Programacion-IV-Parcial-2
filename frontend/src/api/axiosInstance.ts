/**
 * Instancia de Axios con interceptor de autenticación.
 *
 * Interceptor de request:
 *   Lee el token de localStorage y lo agrega automáticamente
 *   en el header Authorization de cada request.
 *
 * Interceptor de response:
 *   Si el servidor devuelve 401, limpia el localStorage
 *   y redirige al login automáticamente.
 */

import axios from 'axios'

const BASE_URL = 'http://localhost:8000'

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // necesario para cookie HttpOnly de refresh token (si se implementa)
})

// ── Interceptor de REQUEST ────────────────────────────────
// Agrega el token JWT en cada petición automáticamente si está presente en localStorage
axiosInstance.interceptors.request.use(
  (config) => {
    const stored = localStorage.getItem('auth_user')
    if (stored) {
      try {
        const { token } = JSON.parse(stored)
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch {
        // si el JSON está corrupto, se ignora el token y se limpia el localStorage
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Interceptor de RESPONSE ───────────────────────────────
// Si el servidor devuelve 401, limpia sesión y redirige al login
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default axiosInstance