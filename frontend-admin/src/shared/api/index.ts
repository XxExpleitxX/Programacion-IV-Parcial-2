
import axiosInstance from './axiosInstance'
import type {
  Categoria, CategoriaCreate, CategoriaUpdate,
  Ingrediente, IngredienteCreate, IngredienteUpdate,
  Producto, ProductoCreate, ProductoUpdate,
  UnidadMedida, Pedido, CloudinaryResponse, Paginated,
} from '../types'

// ─── Uploads (Cloudinary) ─────────────────────────────────
export const uploadsApi = {
  // Sube una imagen vía multipart/form-data. No fijamos Content-Type a mano:
  // dejamos que el navegador ponga el boundary del multipart.
  subir: (file: File, folder = 'productos') => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', folder)
    // postForm fija Content-Type: multipart/form-data (con boundary) automáticamente,
    // sobrescribiendo el default JSON del axiosInstance. Sin casts a `any`.
    return axiosInstance
      .postForm<CloudinaryResponse>('/uploads/imagen', form)
      .then(r => r.data)
  },

  // Elimina una imagen del CDN. El backend acepta public_id con '/' ({public_id:path}),
  // por eso no encodeamos las barras.
  eliminar: (publicId: string) =>
    axiosInstance.delete(`/uploads/imagen/${publicId}`).then(r => r.data),
}

// ─── UnidadMedida ─────────────────────────────────────────
export const unidadesApi = {
  getAll: () =>
    axiosInstance.get<UnidadMedida[]>('/unidades-medida/').then(r => r.data),
}

// ─── Categorias ───────────────────────────────────────────
export const categoriasApi = {
  getAll: (params?: { nombre?: string; parent_id?: number; offset?: number; limit?: number }) =>
    axiosInstance.get<Categoria[]>('/categorias/', { params }).then(r => r.data),
  getArbol: () =>
    axiosInstance.get<Categoria[]>('/categorias/arbol').then(r => r.data),
  getById: (id: number) =>
    axiosInstance.get<Categoria>(`/categorias/${id}`).then(r => r.data),
  create: (data: CategoriaCreate) =>
    axiosInstance.post<Categoria>('/categorias/', data).then(r => r.data),
  update: (id: number, data: CategoriaUpdate) =>
    axiosInstance.put<Categoria>(`/categorias/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    axiosInstance.delete(`/categorias/${id}`).then(r => r.data),
}

// ─── Ingredientes ─────────────────────────────────────────
export const ingredientesApi = {
  getAll: (params?: { nombre?: string; offset?: number; limit?: number }) =>
    axiosInstance.get<Ingrediente[]>('/ingredientes/', { params }).then(r => r.data),
  getById: (id: number) =>
    axiosInstance.get<Ingrediente>(`/ingredientes/${id}`).then(r => r.data),
  create: (data: IngredienteCreate) =>
    axiosInstance.post<Ingrediente>('/ingredientes/', data).then(r => r.data),
  update: (id: number, data: IngredienteUpdate) =>
    axiosInstance.put<Ingrediente>(`/ingredientes/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    axiosInstance.delete(`/ingredientes/${id}`).then(r => r.data),
}

// ─── Productos ────────────────────────────────────────────
export const productosApi = {
  getAll: (params?: {
    nombre?: string
    disponible?: boolean
    categoria_id?: number
    precio_min?: number
    precio_max?: number
    page?: number
    size?: number
  }) =>
    // La API devuelve el envelope paginado; el admin consume todos los items
    // (sin UI de paginación) pidiendo el tope de tamaño de página.
    axiosInstance
      .get<Paginated<Producto>>('/productos/', { params: { size: 100, ...params } })
      .then(r => r.data.items),
  getById: (id: number) =>
    axiosInstance.get<Producto>(`/productos/${id}`).then(r => r.data),
  create: (data: ProductoCreate) =>
    axiosInstance.post<Producto>('/productos/', data).then(r => r.data),
  update: (id: number, data: ProductoUpdate) =>
    axiosInstance.put<Producto>(`/productos/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    axiosInstance.delete(`/productos/${id}`).then(r => r.data),
  patchDisponibilidad: (id: number, disponible: boolean) =>
    axiosInstance.patch<Producto>(`/productos/${id}/disponibilidad`, { disponible }).then(r => r.data),
  patchStock: (id: number, stock_cantidad: number) =>
    axiosInstance.patch<Producto>(`/productos/${id}/stock`, { stock_cantidad }).then(r => r.data),
  calcularPrecio: (id: number, margen: number) =>
  axiosInstance.get(`/productos/${id}/precio-sugerido`, { params: { margen } }).then(r => r.data),
}

// ─── Pedidos ──────────────────────────────────────────────
export const pedidosApi = {
  getAll: (params?: { estado?: string }) =>
    axiosInstance
      .get<Paginated<Pedido>>('/pedidos/', { params: { size: 100, ...params } })
      .then(r => r.data.items),
  getById: (id: number) =>
    axiosInstance.get<Pedido>(`/pedidos/${id}`).then(r => r.data),
  getHistorial: (id: number) =>
    axiosInstance.get(`/pedidos/${id}/historial`).then(r => r.data),
  avanzarEstado: (id: number, estado_hacia: string, motivo?: string) =>
    axiosInstance.post<Pedido>(`/pedidos/${id}/estado`, {
      estado_hacia,
      motivo: motivo || null,
    }).then(r => r.data),
  crear: (data: {
    direccion_id?: number | null
    forma_pago_codigo: string
    notas?: string
    items: { producto_id: number; cantidad: number; personalizacion?: number[] | null }[]
  }) =>
    axiosInstance.post<Pedido>('/pedidos/', data).then(r => r.data),
}
// ─── Estadísticas ─────────────────────────────────────────
import type {
  ResumenKPI, VentasPeriodoItem, ProductoTopItem,
  PedidosEstadoItem, IngresosResponse,
} from '../types'

export const estadisticasApi = {
  resumen: () =>
    axiosInstance.get<ResumenKPI>('/estadisticas/resumen').then(r => r.data),

  ventas: (params?: { desde?: string; hasta?: string; agrupacion?: 'day' | 'week' | 'month' }) =>
    axiosInstance.get<VentasPeriodoItem[]>('/estadisticas/ventas', { params }).then(r => r.data),

  productosTop: (limit = 8) =>
    axiosInstance.get<ProductoTopItem[]>('/estadisticas/productos-top', { params: { limit } }).then(r => r.data),

  pedidosPorEstado: () =>
    axiosInstance.get<PedidosEstadoItem[]>('/estadisticas/pedidos-por-estado').then(r => r.data),

  ingresos: (params?: { desde?: string; hasta?: string }) =>
    axiosInstance.get<IngresosResponse>('/estadisticas/ingresos', { params }).then(r => r.data),
}
