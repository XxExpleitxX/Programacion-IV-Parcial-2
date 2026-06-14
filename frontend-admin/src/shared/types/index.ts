// ─── Paginación (envelope estándar de la API) ────────────
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// ─── UnidadMedida ─────────────────────────────────────────
export interface UnidadMedida {
  id: number;
  nombre: string;
  simbolo: string;
  tipo: string;
}

// ─── Categoria ───────────────────────────────────────────
export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  parent_id: number | null;
  imagen_url: string | null;
  subcategorias?: Categoria[];
}

export interface CategoriaCreate {
  nombre: string;
  descripcion?: string;
  parent_id?: number | null;
}

export interface CategoriaUpdate {
  nombre?: string;
  descripcion?: string;
  parent_id?: number | null;
}

// ─── Ingrediente ─────────────────────────────────────────
export interface Ingrediente {
  id: number;
  nombre: string;
  descripcion: string | null;
  es_alergeno: boolean;
  precio_unitario: number;
  stock_disponible?: number;       
  unidad_medida_id?: number | null;
}

export interface IngredienteCreate {
  nombre: string;
  descripcion?: string;
  es_alergeno?: boolean;
  precio_unitario: number;
  stock_disponible?: number;
  unidad_medida_id?: number | null;
}

export interface IngredienteUpdate {
  nombre?: string;
  descripcion?: string;
  es_alergeno?: boolean;
  precio_unitario?: number;
  stock_disponible?: number;
  unidad_medida_id?: number | null;
}

// ─── Producto ────────────────────────────────────────────
export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio_base: number;
  disponible: boolean;
  stock_cantidad: number;
  unidad_venta_id: number | null;
  es_manufacturado: boolean;
  categorias: Categoria[];
  imagenes_url: string[];
}

export interface ProductoCreate {
  nombre: string;
  descripcion?: string;
  precio_base: number;
  disponible?: boolean;
  stock_cantidad?: number;
  unidad_venta_id?: number | null;
  categoria_ids: number[];
  es_manufacturado?: boolean;
  ingrediente_ids?: number[];
  imagenes_url?: string[];
}

export interface ProductoUpdate {
  nombre?: string;
  descripcion?: string;
  precio_base?: number;
  disponible?: boolean;
  stock_cantidad?: number;
  unidad_venta_id?: number | null;
  categoria_ids?: number[];
  es_manufacturado?: boolean;
  imagenes_url?: string[];
}

// ─── Cloudinary ──────────────────────────────────────────
export interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
}

export interface DetallePedido {
  pedido_id: number;
  producto_id: number;
  cantidad: number;
  nombre_snapshot: string;
  precio_snapshot: number;
  subtotal_snap: number;
  personalizacion: number[] | null;
  created_at: string;
}

export interface Pedido {
  id: number;
  usuario_id: number;
  direccion_id: number | null;
  estado_codigo: string;
  forma_pago_codigo: string;
  subtotal: number;
  descuento: number;
  costo_envio: number;
  total: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
  detalles: DetallePedido[];
}
// ─── Estadísticas ─────────────────────────────────────────
export interface ResumenKPI {
  ventas_hoy: number
  ticket_promedio: number
  pedidos_activos: number
  ventas_mes: number
}

export interface VentasPeriodoItem {
  periodo: string
  total_ventas: number
  cantidad_pedidos: number
}

export interface ProductoTopItem {
  producto_id: number
  nombre: string
  ingresos: number
  cantidad_vendida: number
}

export interface PedidosEstadoItem {
  estado_codigo: string
  cantidad: number
}

export interface IngresoFormaPagoItem {
  forma_pago_codigo: string
  total: number
  cantidad: number
}

export interface IngresosResponse {
  items: IngresoFormaPagoItem[]
  total_general: number
}
