import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { productosApi, categoriasApi, unidadesApi, ingredientesApi } from '../api'
import type { Producto, ProductoCreate, ProductoUpdate, Categoria, UnidadMedida, Ingrediente } from '../types'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { toggleCategoriaConCascada } from '../utils/categorias'

// ── Tipos internos ────────────────────────────────────────────────────────

interface IngredienteConCantidad {
  ingrediente: Ingrediente
  cantidad: number
}

// ── Formulario ────────────────────────────────────────────────────────────

interface FormProps {
  initial?: Producto
  categorias: Categoria[]
  unidades: UnidadMedida[]
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
  const [validacionError, setValidacionError] = useState<string | null>(null)
 
  // Calculadora integrada
  const [costoOperativo, setCostoOperativo] = useState('0')
  const [margen, setMargen] = useState(30)
 
  const { data: ingredientesDisponibles = [] } = useQuery({
    queryKey: ['ingredientes'],
    queryFn: () => ingredientesApi.getAll(),
  })
  const [ingredientesSeleccionados, setIngredientesSeleccionados] = useState<IngredienteConCantidad[]>([])
 
  // Cálculo automático en tiempo real
  const costoIngredientes = ingredientesSeleccionados.reduce((sum, { ingrediente, cantidad }) => {
    return sum + (ingrediente.precio_unitario ?? 0) * cantidad
  }, 0)
  const costoTotal = costoIngredientes + Number(costoOperativo)
  const precioSugerido = costoTotal * (1 + margen / 100)
 
  const aplanar = (cats: Categoria[], nivel = 0): { cat: Categoria; nivel: number }[] =>
    cats.flatMap(c => [{ cat: c, nivel }, ...aplanar(c.subcategorias ?? [], nivel + 1)])
  const opcionesCats = aplanar(categorias)
 
  const toggleCategoria = (id: number) => {
    setCategoriaIds(prev => toggleCategoriaConCascada(id, categorias, prev))
  }
 
  const toggleIngrediente = (ing: Ingrediente) => {
    setIngredientesSeleccionados(prev => {
      const existe = prev.find(i => i.ingrediente.id === ing.id)
      if (existe) return prev.filter(i => i.ingrediente.id !== ing.id)
      return [...prev, { ingrediente: ing, cantidad: 1 }]
    })
  }
 
  const setCantidad = (ingredienteId: number, cantidad: number) => {
    setIngredientesSeleccionados(prev =>
      prev.map(i => i.ingrediente.id === ingredienteId ? { ...i, cantidad } : i)
    )
  }
 
  const getUnidadSimbolo = (id: number | null | undefined) =>
    id ? unidades.find(u => u.id === id)?.simbolo ?? '' : ''
 
  const aplicarPrecioSugerido = () => {
    setPrecioBase(precioSugerido.toFixed(2))
  }
 
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidacionError(null)
 
    if (esManufacturado && ingredientesSeleccionados.length === 0) {
      setValidacionError('Debe cargar un ingrediente para guardarlo')
      return
    }
 
    onSubmit({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      precio_base: Number(precioBase),
      disponible,
      stock_cantidad: esManufacturado ? 0 : Number(stockCantidad),
      unidad_venta_id: unidadVentaId,
      es_manufacturado: esManufacturado,
      categoria_ids: categoriaIds,
      ingrediente_ids: esManufacturado ? ingredientesSeleccionados.map(i => i.ingrediente.id) : [],
    })
  }
 
  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
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
 
        {!esManufacturado && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Stock</label>
            <input className="input-field" type="number" min="0" value={stockCantidad}
              onChange={e => setStockCantidad(e.target.value)} />
          </div>
        )}
 
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
          <input type="checkbox" checked={esManufacturado}
            onChange={e => { setEsManufacturado(e.target.checked); setValidacionError(null); setIngredientesSeleccionados([]) }}
            className="w-4 h-4 accent-brand-600" />
          <span className="text-sm text-slate-300">Es manufacturado</span>
        </div>
      </div>
 
      {/* ── Sección manufacturado ── */}
      {esManufacturado && (
        <>
          {/* Lista de ingredientes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Ingredientes * <span className="text-slate-500">(al menos uno)</span>
            </label>
            <div className="border border-border rounded-lg p-3 max-h-36 overflow-y-auto space-y-1 mb-3">
              {ingredientesDisponibles.length === 0
                ? <p className="text-slate-500 text-xs">No hay ingredientes cargados</p>
                : ingredientesDisponibles.map(ing => {
                  const seleccionado = ingredientesSeleccionados.some(i => i.ingrediente.id === ing.id)
                  return (
                    <label key={ing.id} className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 transition-colors ${
                      seleccionado ? 'bg-brand-900/30' : 'hover:bg-surface/50'
                    }`}>
                      <input type="checkbox" checked={seleccionado}
                        onChange={() => toggleIngrediente(ing)} className="w-3.5 h-3.5 accent-brand-600" />
                      <span className="text-sm text-slate-300 flex-1">{ing.nombre}</span>
                      <span className="text-xs text-slate-500">
                        ${ing.precio_unitario?.toFixed(2)} / {getUnidadSimbolo(ing.unidad_medida_id) || 'u'}
                      </span>
                      {ing.es_alergeno && (
                        <span className="text-xs bg-red-900/40 text-red-300 px-1.5 rounded">Alérgeno</span>
                      )}
                    </label>
                  )
                })
              }
            </div>
 
            {/* Cantidades por ingrediente */}
            {ingredientesSeleccionados.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-medium text-slate-400">Cantidad por unidad de producto:</p>
                {ingredientesSeleccionados.map(({ ingrediente, cantidad }) => {
                  const simbolo = getUnidadSimbolo(ingrediente.unidad_medida_id)
                  const subtotal = (ingrediente.precio_unitario ?? 0) * cantidad
                  return (
                    <div key={ingrediente.id} className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2">
                      <span className="text-sm text-slate-200 flex-1">{ingrediente.nombre}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min="0.001" step="0.001" value={cantidad}
                          onChange={e => setCantidad(ingrediente.id, Number(e.target.value))}
                          className="input-field w-24 text-right text-sm py-1"
                        />
                        <span className="text-xs text-slate-400 w-8">{simbolo || 'u'}</span>
                      </div>
                      <span className="text-xs text-brand-400 font-medium w-20 text-right">
                        = ${subtotal.toFixed(2)}
                      </span>
                      <button type="button" onClick={() => toggleIngrediente(ingrediente)}
                        className="text-red-400 hover:text-red-300 text-xs">✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
 
          {/* ── Calculadora integrada ── */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">💰 Calculadora de precio</p>
 
            {/* Detalle de costos */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Costo ingredientes:</span>
                <span className="text-slate-200">${costoIngredientes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Costos operativos (alquiler, gas, etc.):</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number" min="0" step="0.01" value={costoOperativo}
                    onChange={e => setCostoOperativo(e.target.value)}
                    className="w-24 bg-card border border-border rounded px-2 py-0.5 text-white text-sm text-right focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
              <div className="flex justify-between text-slate-300 border-t border-border pt-1">
                <span>Costo total:</span>
                <span className="font-medium">${costoTotal.toFixed(2)}</span>
              </div>
            </div>
 
            {/* Margen */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-slate-400">Margen de ganancia</label>
                <span className="text-brand-400 font-bold text-sm">{margen}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="300" value={margen}
                  onChange={e => setMargen(Number(e.target.value))}
                  className="flex-1 accent-brand-600" />
                <input type="number" min="0" max="1000" value={margen}
                  onChange={e => setMargen(Number(e.target.value))}
                  className="w-16 bg-card border border-border rounded px-2 py-0.5 text-white text-sm text-center focus:outline-none focus:border-brand-500" />
              </div>
            </div>
 
            {/* Precio sugerido + botón aplicar */}
            <div className="flex items-center justify-between bg-brand-900/20 border border-brand-800/50 rounded-lg px-4 py-3">
              <div>
                <p className="text-xs text-slate-400">Precio sugerido de venta</p>
                <p className="text-2xl font-bold text-brand-400">${precioSugerido.toFixed(2)}</p>
              </div>
              <button
                type="button"
                onClick={aplicarPrecioSugerido}
                className="btn-primary py-2 px-4 text-sm"
              >
                Usar este precio →
              </button>
            </div>
          </div>
 
          {validacionError && (
            <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">
              ⚠️ {validacionError}
            </p>
          )}
        </>
      )}
 
      {/* Categorías */}
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

// ── Calculadora de precio ─────────────────────────────────────────────────

interface CalculadoraProps {
  productoId: number
  onClose: () => void
}

function CalculadoraPrecio({ productoId, onClose }: CalculadoraProps) {
  const [margen, setMargen] = useState(30)
  const [resultado, setResultado] = useState<{ costo_total: number; precio_sugerido: number; margen_porcentaje: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const calcular = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await productosApi.calcularPrecio(productoId, margen)
      setResultado(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">Calculá el precio sugerido de venta basado en el costo de ingredientes.</p>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Margen de ganancia (%)</label>
        <div className="flex gap-3 items-center">
          <input type="range" min="0" max="200" value={margen}
            onChange={e => setMargen(Number(e.target.value))} className="flex-1" />
          <input type="number" min="0" max="1000" value={margen}
            onChange={e => setMargen(Number(e.target.value))}
            className="input-field w-24 text-center" />
          <span className="text-slate-400">%</span>
        </div>
      </div>
      <button onClick={calcular} disabled={loading} className="btn-primary w-full">
        {loading ? 'Calculando...' : 'Calcular precio'}
      </button>
      {error && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
      {resultado && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Costo de ingredientes:</span>
            <span className="text-slate-200">${resultado.costo_total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Margen aplicado:</span>
            <span className="text-slate-200">{resultado.margen_porcentaje}%</span>
          </div>
          <div className="flex justify-between text-base font-bold border-t border-border pt-2">
            <span className="text-slate-300">Precio sugerido:</span>
            <span className="text-brand-400 text-lg">${resultado.precio_sugerido.toFixed(2)}</span>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={onClose} className="btn-secondary">Cerrar</button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────

export default function ProductosPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { role } = useAuth()
  const esAdmin = role === 'ADMIN'

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

  const aplanar = (cats: Categoria[], nivel = 0): { cat: Categoria; nivel: number }[] =>
    cats.flatMap(c => [{ cat: c, nivel }, ...aplanar(c.subcategorias ?? [], nivel + 1)])
  const opcionesCats = aplanar(arbolCats)

  const getUnidadSimbolo = (id: number | null) => {
    if (!id) return '—'
    return unidades.find(u => u.id === id)?.simbolo ?? '—'
  }

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
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Descripción</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Unidad</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Categoría</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {productos.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500">Sin resultados</td></tr>
              )}
              {productos.map(p => (
                <tr key={p.id} className="hover:bg-surface/50 transition-colors">
                  <td className="py-3">
                    <div className="font-medium text-slate-100">{p.nombre}</div>
                    {p.descripcion && <div className="text-xs text-slate-500 truncate max-w-xs">{p.descripcion}</div>}
                    <div className="text-brand-400 text-xs font-medium">${(p.precio_base ?? 0).toFixed(2)}</div>
                  </td>
                  <td className="py-3">
                    {p.es_manufacturado
                      ? <span className="text-slate-500 text-xs italic">En base a insumos</span>
                      : <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          p.stock_cantidad > 0 ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                        }`}>{p.stock_cantidad ?? 0}</span>
                    }
                  </td>
                  <td className="py-3 text-slate-300 text-sm">{getUnidadSimbolo(p.unidad_venta_id)}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.categorias ?? []).map(c => (
                        <span key={c.id} className="px-2 py-0.5 bg-brand-900/50 text-brand-300 rounded text-xs">{c.nombre}</span>
                      ))}
                      {(p.categorias ?? []).length === 0 && <span className="text-slate-500 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.es_manufacturado ? 'bg-purple-900/40 text-purple-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {p.es_manufacturado ? 'Manufacturado' : 'Terminado'}
                    </span>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => esAdmin && toggleDisponible.mutate({ id: p.id, disponible: !p.disponible })}
                      disabled={!esAdmin}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        p.disponible ? 'bg-green-900/40 text-green-300 hover:bg-green-900/70' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                      } ${!esAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {p.disponible ? 'Disponible' : 'No disponible'}
                    </button>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2 flex-wrap">
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
          title={editing ? 'Editar producto' : 'Nuevo producto'} wide>
          <ProductoForm
            initial={editing ?? undefined}
            categorias={arbolCats}
            unidades={unidades}
            onSubmit={handleSubmit}
            isLoading={createMut.isPending || updateMut.isPending}
            error={mutError}
          />
        </Modal>
      )}
    </div>
  )
}