import axiosInstance from './axiosInstance'
import type { Producto, Categoria, Pedido, HistorialEstado, Paginated } from '../types'

// ─── Productos ────────────────────────────────────────────
export const productosApi = {
  getAll: (params?: {
    nombre?: string
    categoria_id?: number
    precio_min?: number
    precio_max?: number
    disponible?: boolean
    page?: number
    size?: number
  }) => axiosInstance.get<Paginated<Producto>>('/productos/', { params }).then(r => r.data),

  getById: (id: number) =>
    axiosInstance.get<Producto>(`/productos/${id}`).then(r => r.data),
}

// ─── Categorias ───────────────────────────────────────────
export const categoriasApi = {
  getArbol: () =>
    axiosInstance.get<Categoria[]>('/categorias/arbol').then(r => r.data),
}

// ─── Auth ─────────────────────────────────────────────────
export const authApi = {
  login: async (username: string, password: string) => {
    const res = await axiosInstance.post('/auth/login', { username, password })
    const token = res.data.access_token
    const refresh_token = res.data.refresh_token
    const me = await axiosInstance.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return { token, refresh_token, user: me.data }
  },
  logout: (refreshToken?: string) =>
    axiosInstance.post('/auth/logout', { refresh_token: refreshToken ?? '' }).catch(() => {}),
  register: (data: {
    username: string
    nombre: string
    apellido: string
    email: string
    password: string
  }) => axiosInstance.post('/auth/register', data).then(r => r.data),
}

// ─── Pedidos ──────────────────────────────────────────────
export const pedidosApi = {
  crear: (data: {
    forma_pago_codigo: string
    notas?: string
    direccion_id?: number | null
    items: { producto_id: number; cantidad: number }[]
  }) => axiosInstance.post<Pedido>('/pedidos/', data).then(r => r.data),

  getMisPedidos: () =>
    axiosInstance.get<Paginated<Pedido>>('/pedidos/', { params: { size: 100 } }).then(r => r.data.items),

  getById: (id: number) =>
    axiosInstance.get<Pedido>(`/pedidos/${id}`).then(r => r.data),

  getHistorial: (id: number) =>
    axiosInstance.get<HistorialEstado[]>(`/pedidos/${id}/historial`).then(r => r.data),

  cancelar: (id: number, motivo: string) =>
    axiosInstance.post<Pedido>(`/pedidos/${id}/estado`, {
      estado_hacia: 'CANCELADO',
      motivo,
    }).then(r => r.data),
}

// ─── Pagos (MercadoPago) ──────────────────────────────────
export interface PagoResponse {
  id: number
  pedido_id: number
  mp_payment_id: number | null
  mp_status: string
  mp_status_detail: string | null
  external_reference: string
  transaction_amount: number
  payment_method_id: string | null
  created_at: string
}

export const pagosApi = {
  // Recibe el token de tarjeta generado por el brick CardPayment de MP.
  crear: (data: {
    pedido_id: number
    token: string
    payment_method_id: string
    installments: number
    payer_email: string
    issuer_id?: string
  }) => axiosInstance.post<PagoResponse>('/pagos/crear', data).then(r => r.data),

  // Checkout PRO: crea la preferencia y devuelve el init_point para redirigir.
  crearPreferencia: (pedido_id: number) =>
    axiosInstance
      .post<{ preference_id: string; init_point: string; pedido_id: number }>('/pagos/preferencia', { pedido_id })
      .then(r => r.data),

  // Al volver de Checkout PRO: sincroniza el pago por su payment_id (y confirma el pedido).
  confirmarRetorno: (payment_id: string) =>
    axiosInstance.post('/pagos/confirmar', { payment_id }).then(r => r.data),

  // Verifica el estado del pago de un pedido (busca en MP por external_reference).
  verificarPago: (pedido_id: number) =>
    axiosInstance
      .post<{ estado: string; mp_status: string }>('/pagos/verificar', { pedido_id })
      .then(r => r.data),
}
