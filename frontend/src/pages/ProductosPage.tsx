import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { productosApi, categoriasApi, unidadesApi, ingredientesApi } from '../api'
import type { Producto, ProductoCreate, ProductoUpdate, Categoria, UnidadMedida, Ingrediente } from '../types'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'

// ── Formulario ────────────────────────────────────────────────────────────

interface FormProps {
  initial?: Producto
  categorias: Categoria[]
  unidades: UnidadMedida[]
  ingredientes: Ingrediente[]
  onSubmit: (data: ProductoCreate | ProductoUpdate) => void
  isLoading: boolean
  error: string | null
}

function ProductoForm({ initial, categorias, unidades, onSubmit, isLoading, error }: FormProps) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [precioBase, setPrecioBase] = useState(String(initial?.precio_base ?? ''))
  const [disponible, setDisponible] = useState(initial?.disponible ?? true)
  const [stockCantidad, setStockCantidad] = useState(String(initial?.stock_cantidad ?? 0))
  const [unidadVentaId, setUnidadVentaId] = useState<number | null>(initial?.unidad_venta_id ?? null)
  const [esManufacturado, setEsManufacturado] = useState(initial?.es_manufacturado ?? false)
  const [categoriaIds, setCategoriaIds] = useState<number[]>(initial?.categorias.map(c => c.id) ?? [])

  // Aplanar árbol categorías
  const aplanar = (cats: Categoria[], nivel = 0): { cat: Categoria; nivel: number }[] =>
    cats.flatMap(c => [{ cat: c, nivel }, ...aplanar(c.subcategorias ?? [], nivel + 1)])
  const opcionesCats = aplanar(categorias)

  const toggleCategoria = (id: number) => {
    setCategoriaIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      precio_base: Number(precioBase),
      disponible,
      stock_cantidad: Number(stockCantidad),
      unidad_venta_id: unidadVentaId,
      es_manufacturado: esManufacturado,
      categoria_ids: categoriaIds,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1">Nombre *</label>
          <input className="input-field" value={nombre} onChange={e => setNombre(e.target.value)} required minLength={2} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1">Descripción</label>
          <textarea className="input-field resize-none" rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Precio base *</label>
          <input className="input-field" type="number" min="0" step="0.01" value={precioBase}
            onChange={e => setPrecioBase(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Stock</label>
          <input className="input-field" type="number" min="0" value={stockCantidad}
            onChange={e => setStockCantidad(e.target.value)} />
        </div>

        {/* Parametrizar unidad */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1">Unidad de venta</label>
          <select className="input-field" value={unidadVentaId ?? ''} onChange={e => setUnidadVentaId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Sin unidad (por pieza) —</option>
            {unidades.map(u => (
              <option key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" checked={disponible} onChange={e => setDisponible(e.target.checked)} className="w-4 h-4 accent-brand-600" />
          <span className="text-sm text-slate-300">Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={esManufacturado} onChange={e => setEsManufacturado(e.target.checked)} className="w-4 h-4 accent-brand-600" />
          <span className="text-sm text-slate-300">Es manufacturado</span>
        </div>
      </div>

      {/* Categorías como árbol */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Categorías</label>
        <div className="border border-border rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
          {opcionesCats.map(({ cat, nivel }) => (
            <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-surface/50 rounded px-2 py-0.5"
              style={{ paddingLeft: `${(nivel * 16) + 8}px` }}>
              <input type="checkbox" checked={categoriaIds.includes(cat.id)}
                onChange={() => toggleCategoria(cat.id)} className="w-3.5 h-3.5 accent-brand-600" />
              <span className="text-sm text-slate-300">{cat.nombre}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? 'Guardando...' : initial ? 'Actualizar' : 'Crear'}
        </button>
      </div>
    </form>
  )
}

// ── Página principal ──────────────────────────────────────────────────────

export default function ProductosPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { role } = useAuth()
  const esAdmin = role === 'ADMIN'

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroDisponible, setFiltroDisponible] = useState<string>('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [mutError, setMutError] = useState<string | null>(null)

  const { data: productos = [], isLoading, isError } = useQuery({
    queryKey: ['productos', search, filtroDisponible, filtroCategoria],
    queryFn: () => productosApi.getAll({
      nombre: search || undefined,
      disponible: filtroDisponible !== '' ? filtroDisponible === 'true' : undefined,
      categoria_id: filtroCategoria ? Number(filtroCategoria) : undefined,
    }),
  })

  const { data: arbolCats = [] } = useQuery({ queryKey: ['categorias-arbol'], queryFn: categoriasApi.getArbol })
  const { data: unidades = [] } = useQuery({ queryKey: ['unidades'], queryFn: unidadesApi.getAll })
  const { data: ingredientes = [] } = useQuery({ queryKey: ['ingredientes'], queryFn: () => ingredientesApi.getAll() })

  // Aplanar categorías para el select de filtro
  const aplanar = (cats: Categoria[], nivel = 0): { cat: Categoria; nivel: number }[] =>
    cats.flatMap(c => [{ cat: c, nivel }, ...aplanar(c.subcategorias ?? [], nivel + 1)])
  const opcionesCats = aplanar(arbolCats)

  const createMut = useMutation({
    mutationFn: (data: ProductoCreate) => productosApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['productos'] }); setModalOpen(false); setMutError(null) },
    onError: (err: Error) => setMutError(err.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProductoUpdate }) => productosApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['productos'] }); setModalOpen(false); setEditing(null); setMutError(null) },
    onError: (err: Error) => setMutError(err.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => productosApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })

  const toggleDisponible = useMutation({
    mutationFn: ({ id, disponible }: { id: number; disponible: boolean }) =>
      productosApi.patchDisponibilidad(id, disponible),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })

  const handleSubmit = (data: ProductoCreate | ProductoUpdate) => {
    if (editing) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data as ProductoCreate)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-slate-100">Productos</h1>
          <p className="text-slate-400 text-sm mt-1">Gestión de productos</p>
        </div>
        {esAdmin && (
          <button onClick={() => { setEditing(null); setMutError(null); setModalOpen(true) }} className="btn-primary">
            + Nuevo producto
          </button>
        )}
      </div>

      {/* Filtros — 3 filtros */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input className="input-field max-w-xs" placeholder="Buscar por nombre..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input-field max-w-xs" value={filtroDisponible} onChange={e => setFiltroDisponible(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="true">Disponible</option>
          <option value="false">No disponible</option>
        </select>
        <select className="input-field max-w-xs" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {opcionesCats.map(({ cat, nivel }) => (
            <option key={cat.id} value={cat.id}>{'  '.repeat(nivel)}{cat.nombre}</option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-slate-400">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los productos.</p>}
      {!isLoading && !isError && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Producto</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Precio</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ingredientes</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Categorías</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {productos.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-slate-500">Sin resultados</td></tr>
              )}
              {productos.map(p => (
                <tr key={p.id} className="hover:bg-surface/50 transition-colors">
                  <td className="py-3">
                    <div className="font-medium text-slate-100">{p.nombre}</div>
                    {p.descripcion && <div className="text-xs text-slate-500 truncate max-w-xs">{p.descripcion}</div>}
                  </td>
                  <td className="py-3 font-medium text-brand-400">${(p.precio_base ?? 0).toFixed(2)}</td>

                  {/* Control de stock */}
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.stock_cantidad > 0 ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                    }`}>
                      {p.stock_cantidad ?? 0}
                    </span>
                  </td>

                  {/* Indicar cuántos ingredientes */}
                  <td className="py-3 text-slate-400 text-center">
                    {p.es_manufacturado ? (
                      <span className="px-2 py-0.5 bg-purple-900/40 text-purple-300 rounded text-xs">
                        Manufacturado
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                  </td>

                  {/* Categorías */}
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.categorias ?? []).map(c => (
                        <span key={c.id} className="px-2 py-0.5 bg-brand-900/50 text-brand-300 rounded text-xs">{c.nombre}</span>
                      ))}
                      {(p.categorias ?? []).length === 0 && <span className="text-slate-500 text-xs">—</span>}
                    </div>
                  </td>

                  {/* Tipo */}
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.es_manufacturado ? 'bg-purple-900/40 text-purple-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {p.es_manufacturado ? 'Manufacturado' : 'Terminado'}
                    </span>
                  </td>

                  {/* Estado con toggle */}
                  <td className="py-3">
                    <button
                      onClick={() => esAdmin && toggleDisponible.mutate({ id: p.id, disponible: !p.disponible })}
                      disabled={!esAdmin}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        p.disponible
                          ? 'bg-green-900/40 text-green-300 hover:bg-green-900/70'
                          : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                      } ${!esAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {p.disponible ? 'Disponible' : 'No disponible'}
                    </button>
                  </td>

                  <td className="py-3">
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/productos/${p.id}`)} className="btn-secondary py-1 px-3">Ver</button>
                      {esAdmin && (
                        <>
                          <button onClick={() => { setEditing(p); setMutError(null); setModalOpen(true) }}
                            className="btn-secondary py-1 px-3">Editar</button>
                          <button onClick={() => { if (confirm('¿Eliminar?')) deleteMut.mutate(p.id) }}
                            className="btn-danger py-1 px-3">Eliminar</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {esAdmin && (
        <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setMutError(null) }}
          title={editing ? 'Editar producto' : 'Nuevo producto'}>
          <ProductoForm
            initial={editing ?? undefined}
            categorias={arbolCats}
            unidades={unidades}
            ingredientes={ingredientes}
            onSubmit={handleSubmit}
            isLoading={createMut.isPending || updateMut.isPending}
            error={mutError}
          />
        </Modal>
      )}
    </div>
  )
}