import type {
  Categoria, CategoriaCreate, CategoriaUpdate,
  Ingrediente, IngredienteCreate, IngredienteUpdate,
  Producto, ProductoCreate, ProductoUpdate,
  UnidadMedida,
} from '../types';

const BASE_URL = 'http://localhost:8000';

function getToken(): string | null {
  const stored = localStorage.getItem('auth_user');
  if (!stored) return null;
  try { return JSON.parse(stored).token ?? null; } catch { return null; }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    console.error('API ERROR:', data);
    throw new Error(data?.detail || 'Error en la solicitud');
  }
  return data as T;
}

// ─── UnidadMedida ────────────────────────────────────────
export const unidadesApi = {
  getAll: () => request<UnidadMedida[]>('/unidades-medida/'),
};

// ─── Categorias ──────────────────────────────────────────
export const categoriasApi = {
  getAll: (params?: { nombre?: string; parent_id?: number; offset?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.nombre) qs.set('nombre', params.nombre);
    if (params?.parent_id !== undefined) qs.set('parent_id', String(params.parent_id));
    if (params?.offset !== undefined) qs.set('offset', String(params.offset));
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    return request<Categoria[]>(`/categorias/?${qs}`);
  },
  getArbol: () => request<Categoria[]>('/categorias/arbol'),
  getById: (id: number) => request<Categoria>(`/categorias/${id}`),
  create: (data: CategoriaCreate) => request<Categoria>('/categorias/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: CategoriaUpdate) => request<Categoria>(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/categorias/${id}`, { method: 'DELETE' }),
};

// ─── Ingredientes ────────────────────────────────────────
export const ingredientesApi = {
  getAll: (params?: { nombre?: string; offset?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.nombre) qs.set('nombre', params.nombre);
    if (params?.offset !== undefined) qs.set('offset', String(params.offset));
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    return request<Ingrediente[]>(`/ingredientes/?${qs}`);
  },
  getById: (id: number) => request<Ingrediente>(`/ingredientes/${id}`),
  create: (data: IngredienteCreate) => request<Ingrediente>('/ingredientes/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: IngredienteUpdate) => request<Ingrediente>(`/ingredientes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/ingredientes/${id}`, { method: 'DELETE' }),
};

// ─── Productos ───────────────────────────────────────────
export const productosApi = {
  getAll: (params?: { nombre?: string; disponible?: boolean; categoria_id?: number; precio_min?: number; precio_max?: number; offset?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.nombre) qs.set('nombre', params.nombre);
    if (params?.disponible !== undefined) qs.set('disponible', String(params.disponible));
    if (params?.categoria_id !== undefined) qs.set('categoria_id', String(params.categoria_id));
    if (params?.precio_min !== undefined) qs.set('precio_min', String(params.precio_min));
    if (params?.precio_max !== undefined) qs.set('precio_max', String(params.precio_max));
    if (params?.offset !== undefined) qs.set('offset', String(params.offset));
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    return request<Producto[]>(`/productos/?${qs}`);
  },
  getById: (id: number) => request<Producto>(`/productos/${id}`),
  create: (data: ProductoCreate) => request<Producto>('/productos/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: ProductoUpdate) => request<Producto>(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/productos/${id}`, { method: 'DELETE' }),
  patchDisponibilidad: (id: number, disponible: boolean) =>
    request<Producto>(`/productos/${id}/disponibilidad`, { method: 'PATCH', body: JSON.stringify({ disponible }) }),
};

export const pedidosApi = {
  getAll: (params?: { estado?: string }) => {
    const qs = new URLSearchParams();
    if (params?.estado) qs.set('estado', params.estado);
    return request<any[]>(`/pedidos/?${qs}`);
  },
  getById: (id: number) => request<any>(`/pedidos/${id}`),
  getHistorial: (id: number) => request<any[]>(`/pedidos/${id}/historial`),
  avanzarEstado: (id: number, estado_hacia: string, motivo?: string) =>
    request<any>(`/pedidos/${id}/estado`, {
      method: 'POST',
      body: JSON.stringify({ estado_hacia, motivo: motivo || null }),
    }),
};
 