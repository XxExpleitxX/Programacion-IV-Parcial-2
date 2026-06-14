// ─── Categoria ───────────────────────────────────────────
export interface Categoria {
  id: number
  nombre: string
  descripcion: string | null
  parent_id: number | null
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

// ─── Auth ─────────────────────────────────────────────────
export interface AuthUser {
  username: string
  token: string
  roles: string[]
}
