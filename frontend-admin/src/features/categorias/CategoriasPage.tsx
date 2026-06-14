import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoriasApi } from '../../shared/api'
import type { Categoria, CategoriaCreate, CategoriaUpdate } from '../../shared/types'
import Modal from '../../shared/components/Modal'

// ── Árbol de categorías ────────────────────────────────────────────────────

function CategoriaArbolItem({
  cat, nivel, onEdit, onDelete
}: {
  cat: Categoria
  nivel: number
  onEdit: (c: Categoria) => void
  onDelete: (c: Categoria) => void
}) {
  const [expandido, setExpandido] = useState(true)
  const tieneHijos = (cat.subcategorias?.length ?? 0) > 0

  return (
    <div>
      <div
        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface/50 transition-colors"
        style={{ paddingLeft: `${(nivel * 24) + 12}px` }}  // ← indentación dinámica
      >
        <div className="flex items-center gap-2 flex-1">
          {/* Línea vertical indicadora de nivel */}
          {nivel > 0 && (
            <span className="text-slate-700 select-none">{'│  '.repeat(nivel - 1)}└─</span>
          )}
          {tieneHijos && (
            <button onClick={() => setExpandido(!expandido)} className="text-slate-400 hover:text-slate-100 w-4 text-xs">
              {expandido ? '▼' : '▶'}
            </button>
          )}
          {!tieneHijos && <span className="w-4" />}
          <div>
            <span className="font-medium text-slate-100">{cat.nombre}</span>
            {cat.descripcion && (
              <span className="text-slate-500 text-xs ml-2">— {cat.descripcion}</span>
            )}
            {tieneHijos && (
              <span className="ml-2 text-xs px-1.5 py-0.5 bg-brand-900/40 text-brand-400 rounded">
                {cat.subcategorias!.length} sub
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onEdit(cat)} className="btn-secondary py-1 px-3 text-xs">Editar</button>
          <button onClick={() => onDelete(cat)} className="btn-danger py-1 px-3 text-xs">Eliminar</button>
        </div>
      </div>
      {tieneHijos && expandido && (
        <div>
          {cat.subcategorias!.map(sub => (
            <CategoriaArbolItem key={sub.id} cat={sub} nivel={nivel + 1} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Formulario ────────────────────────────────────────────────────────────

interface FormProps {
  initial?: Categoria
  categorias: Categoria[]
  onSubmit: (data: CategoriaCreate | CategoriaUpdate) => void
  isLoading: boolean
  error: string | null
}

function CategoriaForm({ initial, categorias, onSubmit, isLoading, error }: FormProps) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [parentId, setParentId] = useState<number | null>(initial?.parent_id ?? null)

  // Aplanar árbol para el selector
  const aplanar = (cats: Categoria[], nivel = 0): { cat: Categoria; nivel: number }[] =>
    cats.flatMap(c => [{ cat: c, nivel }, ...aplanar(c.subcategorias ?? [], nivel + 1)])

  const opciones = aplanar(categorias).filter(({ cat }) => cat.id !== initial?.id)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      parent_id: parentId,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Nombre *</label>
        <input className="input-field" value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Bebidas" required minLength={2} maxLength={100} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Descripción</label>
        <textarea className="input-field resize-none" rows={2} value={descripcion}
          onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional..." />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Categoría padre</label>
        <select className="input-field" value={parentId ?? ''} onChange={e => setParentId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">— Sin padre (categoría raíz) —</option>
          {opciones.map(({ cat, nivel }) => (
            <option key={cat.id} value={cat.id}>
              {'  '.repeat(nivel)}{nivel > 0 ? '└ ' : ''}{cat.nombre}
            </option>
          ))}
        </select>
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

export default function CategoriasPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Categoria | null>(null)
  const [mutError, setMutError] = useState<string | null>(null)

  const { data: arbol = [], isLoading, isError } = useQuery({
    queryKey: ['categorias-arbol'],
    queryFn: () => categoriasApi.getArbol(),
  })

  const createMut = useMutation({
    mutationFn: (data: CategoriaCreate) => categoriasApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categorias-arbol'] }); setModalOpen(false); setMutError(null) },
    onError: (err: Error) => setMutError(err.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategoriaUpdate }) => categoriasApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categorias-arbol'] }); setModalOpen(false); setEditing(null); setMutError(null) },
    onError: (err: Error) => setMutError(err.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => categoriasApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categorias-arbol'] }),
    onError: (err: Error) => alert(err.message),
  })

  const handleSubmit = (data: CategoriaCreate | CategoriaUpdate) => {
    if (editing) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data as CategoriaCreate)
  }

  const handleDelete = (cat: Categoria) => {
    if (confirm(`¿Eliminar "${cat.nombre}"?`)) deleteMut.mutate(cat.id)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-slate-100">Categorías</h1>
          <p className="text-slate-400 text-sm mt-1">Árbol de categorías de productos</p>
        </div>
        <button onClick={() => { setEditing(null); setMutError(null); setModalOpen(true) }} className="btn-primary">
          + Nueva categoría
        </button>
      </div>

      {isLoading && <p className="text-slate-400">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar las categorías.</p>}
      {!isLoading && !isError && (
        <div className="card">
          {arbol.length === 0
            ? <p className="text-center text-slate-500 py-8">Sin categorías</p>
            : arbol.map(cat => (
              <CategoriaArbolItem
                key={cat.id}
                cat={cat}
                nivel={0}
                onEdit={c => { setEditing(c); setMutError(null); setModalOpen(true) }}
                onDelete={handleDelete}
              />
            ))
          }
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setMutError(null) }}
        title={editing ? 'Editar categoría' : 'Nueva categoría'}>
        <CategoriaForm
          initial={editing ?? undefined}
          categorias={arbol}
          onSubmit={handleSubmit}
          isLoading={createMut.isPending || updateMut.isPending}
          error={mutError}
        />
      </Modal>
    </div>
  )
}