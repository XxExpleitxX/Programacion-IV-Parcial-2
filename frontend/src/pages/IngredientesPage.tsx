import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ingredientesApi } from '../api'
import type { Ingrediente, IngredienteCreate, IngredienteUpdate } from '../types'
import Modal from '../components/Modal'

interface FormProps {
  initial?: Ingrediente
  onSubmit: (data: IngredienteCreate | IngredienteUpdate) => void
  isLoading: boolean
  error: string | null
}

function IngredienteForm({ initial, onSubmit, isLoading, error }: FormProps) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [esAlergeno, setEsAlergeno] = useState(initial?.es_alergeno ?? false)
  const [precioUnitario, setPrecioUnitario] = useState(String(initial?.precio_unitario ?? '0'))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      es_alergeno: esAlergeno,
      precio_unitario: Number(precioUnitario),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Nombre *</label>
        <input className="input-field" value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Mozzarella" required minLength={2} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Descripción</label>
        <input className="input-field" value={descripcion} onChange={e => setDescripcion(e.target.value)}
          placeholder="Descripción opcional" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Precio unitario *</label>
        <input className="input-field" type="number" min="0" step="0.01"
          value={precioUnitario} onChange={e => setPrecioUnitario(e.target.value)}
          placeholder="0.00" required />
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
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Descripción</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Precio unitario</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Alérgeno</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ingredientes.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500">Sin resultados</td></tr>
              )}
              {ingredientes.map(ing => (
                <tr key={ing.id} className="hover:bg-surface/50 transition-colors">
                  <td className="py-3 font-medium text-slate-100">{ing.nombre}</td>
                  <td className="py-3 text-slate-400">{ing.descripcion ?? '—'}</td>
                  <td className="py-3 text-brand-400 font-medium">
                    ${(ing.precio_unitario ?? 0).toFixed(2)}
                  </td>
                  <td className="py-3">
                    {ing.es_alergeno
                      ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-900/40 text-red-300">Alérgeno</span>
                      : <span className="text-slate-500 text-xs">—</span>}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(ing); setMutError(null); setModalOpen(true) }}
                        className="btn-secondary py-1 px-3">Editar</button>
                      <button onClick={() => { if (confirm('¿Eliminar este ingrediente?')) deleteMut.mutate(ing.id) }}
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
        <IngredienteForm initial={editing ?? undefined} onSubmit={handleSubmit}
          isLoading={createMut.isPending || updateMut.isPending} error={mutError} />
      </Modal>
    </div>
  )
}