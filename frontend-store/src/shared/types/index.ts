// ─── Paginación (envelope estándar de la API) ────────────
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

// ─── Categoria ───────────────────────────────────────────
export interface Categoria {
  id: number
  nombre: string
  descripcion: string | null
  parent_id: number | null
  icono?: string | null
  color?: string | null
  subcategorias?: Categoria[]
}

// ─── Ingrediente ─────────────────────────────────────────
export interface Ingrediente {
  id: number
  nombre: string
  es_alergeno: boolean
}

// ─── Producto ────────────────────────────────────────────
export interface Producto {
  id: number
  nombre: string
  descripcion: string | null
  precio_base: number
  disponible: boolean
  stock_cantidad: number
  es_manufacturado: boolean
  categorias: Categoria[]
  imagenes_url?: string[]
}

// ─── Carrito ──────────────────────────────────────────────
export interface ItemCarrito {
  producto: Producto
  cantidad: number
}

// ─── Pedido ───────────────────────────────────────────────
export interface DetallePedido {
  pedido_id: number
  producto_id: number
  cantidad: number
  nombre_snapshot: string
  precio_snapshot: number
  subtotal_snap: number
  created_at: string
}

export interface Pedido {
  id: number
  usuario_id: number
  estado_codigo: string
  forma_pago_codigo: string
  subtotal: number
  descuento: number
  costo_envio: number
  total: number
  notas: string | null
  created_at: string
  updated_at: string
  detalles: DetallePedido[]
}

// Un registro del audit trail append-only (HistorialEstadoPedido).
export interface HistorialEstado {
  id: number
  pedido_id: number
  estado_desde: string | null   // null en la transición inicial (RN-02)
  estado_hacia: string
  motivo: string | null
  created_at: string
}

// ─── Dirección de entrega ────────────────────────────────
export interface Direccion {
  id: number
  alias: string | null
  linea1: string
  linea2: string | null
  ciudad: string
  provincia: string | null
  codigo_postal: string | null
  es_principal: boolean
}

export interface DireccionInput {
  alias?: string
  linea1: string
  linea2?: string
  ciudad: string
  provincia?: string
  codigo_postal?: string
  es_principal?: boolean
}

// ─── Auth ─────────────────────────────────────────────────
export interface AuthUser {
  username: string
  token: string                 // access token (30 min)
  refresh_token?: string        // refresh token (7 días) — para renovar el access en 401
  roles: string[]
}
