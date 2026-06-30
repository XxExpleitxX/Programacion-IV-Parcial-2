import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ingredientesApi, unidadesApi } from '../../shared/api'
import type { Ingrediente, IngredienteCreate, IngredienteUpdate, UnidadMedida } from '../../shared/types'
import Modal from '../../shared/components/Modal'

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

      {}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Unidad de medida</label>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setUnidadMedidaId(null)}
            className={`p-2 rounded-lg border text-sm flex flex-col items-center gap-0.5 transition-all ${
              unidadMedidaId === null
                ? 'border-brand-500 bg-brand-900/30 text-brand-300'
                : 'border-border hover:border-slate-500 text-slate-400'
            }`}>
            <span className="text-lg">∅</span>
            <span className="text-xs">Sin unidad</span>
          </button>
          {unidades.map(u => (
            <button key={u.id} type="button" onClick={() => setUnidadMedidaId(u.id)}
              className={`p-2 rounded-lg border text-sm flex flex-col items-center gap-0.5 transition-all ${
                unidadMedidaId === u.id
                  ? 'border-brand-500 bg-brand-900/30 text-brand-300'
                  : 'border-border hover:border-slate-500 text-slate-400'
              }`}>
              <span className="text-lg font-bold">{u.simbolo}</span>
              <span className="text-xs">{u.nombre}</span>
            </button>
          ))}
        </div>
        {unidadMedidaId && (
          <p className="text-xs text-slate-500 mt-2">
            💡 Ej: para una pizza usarás{' '}
            <span className="text-slate-300 font-medium">0.200 {unidades.find(u => u.id === unidadMedidaId)?.simbolo ?? ''}</span>
            {' '}de este ingrediente (admite decimales).
          </p>
        )}
      </div>

      {}
      <div onClick={() => setEsAlergeno(!esAlergeno)}
        className="flex items-center justify-between cursor-pointer bg-surface border border-border rounded-lg px-3 py-2.5 select-none">
        <span className="text-sm text-slate-300 flex items-center gap-2">
          <span className="text-amber-400">{esAlergeno ? '🌾' : ''}</span>
          ¿Es alérgeno?
        </span>
        <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          esAlergeno ? 'bg-amber-500' : 'bg-slate-600'
        }`}>
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            esAlergeno ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </span>
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
  
  //  Estados de paginación
  const [page, setPage] = useState(0)
  const limit = 20

  const { data: ingredientes = [], isLoading, isError, isFetching } = useQuery({
    queryKey: ['ingredientes', search, page],
    queryFn: () => ingredientesApi.getAll({ 
      nombre: search || undefined,
      offset: page * limit,
      limit: limit,
    }),
  })

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades'],
    queryFn: () => unidadesApi.getAll(),
  })

  const createMut = useMutation({
    mutationFn: (data: IngredienteCreate) => ingredientesApi.create(data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['ingredientes'] })
      refreshAndResetPage()
      setModalOpen(false)
      setMutError(null)
    },
    onError: (err: Error) => setMutError(err.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: IngredienteUpdate }) => ingredientesApi.update(id, data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['ingredientes'] })
      setModalOpen(false)
      setEditing(null)
      setMutError(null)
    },
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

  // 📊 Lógica de paginación
  const isLastPage = ingredientes.length < limit
  const hasNextPage = !isLastPage
  const hasPrevPage = page > 0

  // Resetear a página 1 cuando se busca
  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(0)
  }

  // Al crear/editar/eliminar, volver a la primera página
  const refreshAndResetPage = () => {
    queryClient.invalidateQueries({ queryKey: ['ingredientes'] })
    setPage(0)
  }

  return (
    <div>
      {}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-slate-100">Ingredientes</h1>
          <p className="text-slate-400 text-sm mt-1">Gestión de ingredientes</p>
        </div>
        <button onClick={() => { setEditing(null); setMutError(null); setModalOpen(true) }} className="btn-primary">
          + Nuevo ingrediente
        </button>
      </div>

      {}
      <div className="mb-5">
        <input className="input-field max-w-sm" placeholder="Buscar por nombre..."
          value={search} onChange={e => handleSearch(e.target.value)} />
      </div>

      {}
      {isLoading && <p className="text-slate-400">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los ingredientes.</p>}
      {!isLoading && !isError && (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre</th>
                  <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
                  <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Precio</th>
                  <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ingredientes.length === 0 && !isFetching && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      {search ? 'Sin resultados para tu búsqueda' : 'Sin ingredientes registrados'}
                    </td>
                  </tr>
                )}
                {ingredientes.map(ing => (
                  <tr key={ing.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-3">
                      <div className="font-medium text-slate-100 flex items-center gap-1.5">
                        {ing.nombre}
                        {ing.es_alergeno && (
                          <span title="Alérgeno" aria-label="Alérgeno" className="text-amber-400">🌾</span>
                        )}
                      </div>
                      {ing.descripcion && <div className="text-xs text-slate-500">{ing.descripcion}</div>}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        (ing.stock_disponible ?? 0) > 0 ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                      }`}>
                        {ing.stock_disponible ?? 0} {getUnidadSimbolo(ing.unidad_medida_id)}
                      </span>
                    </td>
                    <td className="py-3 text-right font-bold text-slate-100">${(ing.precio_unitario ?? 0).toFixed(2)}</td>
                    <td className="py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditing(ing); setMutError(null); setModalOpen(true) }}
                          className="btn-secondary py-1 px-3">Editar</button>
                        <button onClick={() => { if (confirm('¿Eliminar?')) deleteMut.mutate(ing.id) }}
                          className="btn-danger py-1 px-3">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {}
                {isFetching && ingredientes.length > 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center">
                      <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Actualizando...
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {}
          <div className="mt-6 flex items-center justify-between">
            {}
            <div className="text-sm text-slate-400">
              Mostrando <span className="font-semibold text-slate-200">{ingredientes.length}</span> ingredientes
              {search && <span className="text-slate-500"> (filtrados)</span>}
            </div>

            {}
            <div className="flex items-center gap-2">
              {}
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={!hasPrevPage}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-surface text-slate-300 hover:bg-surface-hover hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Anterior
              </button>

              {}
              <div className="flex items-center gap-1 px-3 py-2 bg-brand-900/30 border border-brand-700/50 rounded-lg">
                <span className="text-sm font-semibold text-brand-400">{page + 1}</span>
              </div>

              {}
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!hasNextPage}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-surface text-slate-300 hover:bg-surface-hover hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Siguiente
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setMutError(null) }}
        title={editing ? 'Editar ingrediente' : 'Nuevo ingrediente'}>
        <IngredienteForm
          initial={editing ?? undefined}
          unidades={unidades}
          onSubmit={(data) => {
            handleSubmit(data)
            // Después de guardar, resetear a página 1
            setTimeout(() => setPage(0), 100)
          }}
          isLoading={createMut.isPending || updateMut.isPending}
          error={mutError}
        />
      </Modal>
    </div>
  )
}