import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ingredientesApi, unidadesApi } from '../api'
import type { Ingrediente, IngredienteCreate, IngredienteUpdate, UnidadMedida } from '../types'
import Modal from '../components/Modal'

interface FormProps {
  initial?: Ingrediente
  unidades: UnidadMedida[]
  onSubmit: (data: IngredienteCreate | IngredienteUpdate) => void
  isLoading: boolean
  error: string | null
}

function IngredienteForm({ initial, unidades, onSubmit, isLoading, error }: FormProps) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [esAlergeno, setEsAlergeno] = useState(initial?.es_alergeno ?? false)
  const [precioUnitario, setPrecioUnitario] = useState(String(initial?.precio_unitario ?? '0'))
  const [stockDisponible, setStockDisponible] = useState(String(initial?.stock_disponible ?? '0'))
  const [unidadMedidaId, setUnidadMedidaId] = useState<number | null>(initial?.unidad_medida_id ?? null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      es_alergeno: esAlergeno,
      precio_unitario: Number(precioUnitario),
      stock_disponible: Number(stockDisponible),
      unidad_medida_id: unidadMedidaId,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1">Nombre *</label>
          <input className="input-field" value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Mozzarella" required minLength={2} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1">Descripción</label>
          <input className="input-field" value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="Descripción opcional" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Precio unitario *</label>
          <input className="input-field" type="number" min="0" step="0.01"
            value={precioUnitario} onChange={e => setPrecioUnitario(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Stock disponible</label>
          <input className="input-field" type="number" min="0" step="0.001"
            value={stockDisponible} onChange={e => setStockDisponible(e.target.value)} />
        </div>
      </div>

      {/* Unidad de medida como checkboxes */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Unidad de medida</label>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border hover:border-brand-600 transition-colors">
            <input type="radio" name="unidad" checked={unidadMedidaId === null}
              onChange={() => setUnidadMedidaId(null)} className="accent-brand-600" />
            <span className="text-sm text-slate-300">Sin unidad</span>
          </label>
          {unidades.map(u => (
            <label key={u.id} className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border transition-colors ${
              unidadMedidaId === u.id ? 'border-brand-500 bg-brand-900/30' : 'border-border hover:border-brand-600'
            }`}>
              <input type="radio" name="unidad" checked={unidadMedidaId === u.id}
                onChange={() => setUnidadMedidaId(u.id)} className="accent-brand-600" />
              <div>
                <div className="text-sm text-slate-200 font-medium">{u.simbolo}</div>
                <div className="text-xs text-slate-500">{u.nombre}</div>
              </div>
            </label>
          ))}
        </div>
        {unidadMedidaId && (
          <p className="text-xs text-slate-500 mt-1">
            Stock en {unidades.find(u => u.id === unidadMedidaId)?.nombre ?? ''}.
            Al agregar a un producto manufacturado podés poner decimales (ej: 0.300 {unidades.find(u => u.id === unidadMedidaId)?.simbolo ?? ''})
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" checked={esAlergeno} onChange={e => setEsAlergeno(e.target.checked)}
          className="w-4 h-4 accent-brand-600" />
        <span className="text-sm text-slate-300">Es alérgeno</span>
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

export default function IngredientesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Ingrediente | null>(null)
  const [mutError, setMutError] = useState<string | null>(null)

  const { data: ingredientes = [], isLoading, isError } = useQuery({
    queryKey: ['ingredientes', search],
    queryFn: () => ingredientesApi.getAll({ nombre: search || undefined }),
  })

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades'],
    queryFn: () => unidadesApi.getAll(),
  })

  const createMut = useMutation({
    mutationFn: (data: IngredienteCreate) => ingredientesApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ingredientes'] }); setModalOpen(false); setMutError(null) },
    onError: (err: Error) => setMutError(err.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: IngredienteUpdate }) => ingredientesApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ingredientes'] }); setModalOpen(false); setEditing(null); setMutError(null) },
    onError: (err: Error) => setMutError(err.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => ingredientesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ingredientes'] }),
  })

  const handleSubmit = (data: IngredienteCreate | IngredienteUpdate) => {
    if (editing) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data as IngredienteCreate)
  }

  const getUnidadSimbolo = (id: number | null | undefined) =>
    id ? unidades.find(u => u.id === id)?.simbolo ?? '—' : '—'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-slate-100">Ingredientes</h1>
          <p className="text-slate-400 text-sm mt-1">Gestión de ingredientes</p>
        </div>
        <button onClick={() => { setEditing(null); setMutError(null); setModalOpen(true) }} className="btn-primary">
          + Nuevo ingrediente
        </button>
      </div>

      <div className="mb-5">
        <input className="input-field max-w-sm" placeholder="Buscar por nombre..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading && <p className="text-slate-400">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los ingredientes.</p>}
      {!isLoading && !isError && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Precio unitario</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Unidad</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Alérgeno</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ingredientes.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">Sin resultados</td></tr>
              )}
              {ingredientes.map(ing => (
                <tr key={ing.id} className="hover:bg-surface/50 transition-colors">
                  <td className="py-3">
                    <div className="font-medium text-slate-100">{ing.nombre}</div>
                    {ing.descripcion && <div className="text-xs text-slate-500">{ing.descripcion}</div>}
                  </td>
                  <td className="py-3 text-brand-400 font-medium">${(ing.precio_unitario ?? 0).toFixed(2)}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      (ing.stock_disponible ?? 0) > 0 ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                    }`}>
                      {ing.stock_disponible ?? 0} {getUnidadSimbolo(ing.unidad_medida_id)}
                    </span>
                  </td>
                  <td className="py-3 text-slate-300">{getUnidadSimbolo(ing.unidad_medida_id)}</td>
                  <td className="py-3">
                    {ing.es_alergeno
                      ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-900/40 text-red-300">Alérgeno</span>
                      : <span className="text-slate-500 text-xs">—</span>}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(ing); setMutError(null); setModalOpen(true) }}
                        className="btn-secondary py-1 px-3">Editar</button>
                      <button onClick={() => { if (confirm('¿Eliminar?')) deleteMut.mutate(ing.id) }}
                        className="btn-danger py-1 px-3">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setMutError(null) }}
        title={editing ? 'Editar ingrediente' : 'Nuevo ingrediente'}>
        <IngredienteForm
          initial={editing ?? undefined}
          unidades={unidades}
          onSubmit={handleSubmit}
          isLoading={createMut.isPending || updateMut.isPending}
          error={mutError}
        />
      </Modal>
    </div>
  )
}