import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoriasApi, uploadsApi, productosApi } from '../../shared/api'
import { getApiErrorMessage } from '../../shared/api/errors'
import { cldThumb } from '../../shared/utils/cloudinary'
import type { Categoria, CategoriaCreate, CategoriaUpdate } from '../../shared/types'
import Modal from '../../shared/components/Modal'

// Presets para la identidad visual de la categoría
const EMOJIS = ['🍕', '🍔', '🌭', '🥪', '🌮', '🥗', '🍟', '🍗', '🍝', '🍣', '🍤', '🥟', '🧀', '🍰', '🍦', '🥤', '☕', '🍺', '🥦', '🍱']
const COLORES = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316']
const COLOR_DEFECTO = '#8b5cf6'

// ── Árbol de categorías ────────────────────────────────────────────────────

function CategoriaArbolItem({
  cat, conteo, onEdit, onDelete
}: {
  cat: Categoria
  conteo: Map<number, number>
  onEdit: (c: Categoria) => void
  onDelete: (c: Categoria) => void
}) {
  const [expandido, setExpandido] = useState(true)
  const tieneHijos = (cat.subcategorias?.length ?? 0) > 0
  const count = conteo.get(cat.id) ?? 0

  return (
    <div>
      <div className="group flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface/50 transition-colors">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {tieneHijos ? (
            <button onClick={() => setExpandido(!expandido)} className="text-slate-400 hover:text-slate-100 w-4 text-xs shrink-0">
              {expandido ? '▼' : '▶'}
            </button>
          ) : <span className="w-4 shrink-0" />}
          <div className="min-w-0">
            <span className="font-medium inline-flex items-center gap-1.5">
              {cat.icono && <span>{cat.icono}</span>}
              <span className={cat.color ? '' : 'text-slate-100'} style={cat.color ? { color: cat.color } : undefined}>
                {cat.nombre}
              </span>
            </span>
            {count > 0 && (
              <span className="ml-1.5 text-xs text-slate-500">({count})</span>
            )}
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
        <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(cat)} className="btn-secondary py-1 px-3 text-xs">Editar</button>
          <button onClick={() => onDelete(cat)} className="btn-danger py-1 px-3 text-xs">Eliminar</button>
        </div>
      </div>
      {tieneHijos && expandido && (
        <div className="ml-5 border-l border-border pl-1">
          {cat.subcategorias!.map(sub => (
            <CategoriaArbolItem key={sub.id} cat={sub} conteo={conteo} onEdit={onEdit} onDelete={onDelete} />
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
  const [imagenUrl, setImagenUrl] = useState<string | null>(initial?.imagen_url ?? null)
  const [icono, setIcono] = useState<string | null>(initial?.icono ?? null)
  const [color, setColor] = useState<string | null>(initial?.color ?? null)
  const [busquedaPadre, setBusquedaPadre] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setSubiendo(true)
    try {
      const { secure_url } = await uploadsApi.subir(file, 'categorias')
      setImagenUrl(secure_url)
    } catch (err) {
      setUploadError(getApiErrorMessage(err, 'Error al subir la imagen'))
    } finally {
      setSubiendo(false)
      e.target.value = ''
    }
  }

  // Aplanar árbol para el selector
  const aplanar = (cats: Categoria[], nivel = 0): { cat: Categoria; nivel: number }[] =>
    cats.flatMap(c => [{ cat: c, nivel }, ...aplanar(c.subcategorias ?? [], nivel + 1)])

  const opciones = aplanar(categorias).filter(({ cat }) => cat.id !== initial?.id)
  const opcionesFiltradas = busquedaPadre.trim()
    ? opciones.filter(({ cat }) => cat.nombre.toLowerCase().includes(busquedaPadre.trim().toLowerCase()))
    : opciones

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      parent_id: parentId,
      imagen_url: imagenUrl,
      icono: icono || null,
      color: color || null,
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

      {/* Identidad visual */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Icono</label>
          <div className="flex flex-wrap gap-1 mb-2">
            {EMOJIS.map(e => (
              <button type="button" key={e} onClick={() => setIcono(e)}
                className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${
                  icono === e ? 'bg-brand-900/40 ring-1 ring-brand-500' : 'hover:bg-surface'
                }`}>{e}</button>
            ))}
          </div>
          <input className="input-field" maxLength={4} value={icono ?? ''}
            onChange={e => setIcono(e.target.value || null)} placeholder="O pegá un emoji…" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Color de etiqueta</label>
          <div className="flex flex-wrap gap-1.5">
            {COLORES.map(c => (
              <button type="button" key={c} onClick={() => setColor(c)} style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full transition-transform ${
                  color === c ? 'ring-2 ring-offset-2 ring-offset-card ring-white scale-110' : 'hover:scale-105'
                }`} />
            ))}
            <button type="button" onClick={() => setColor(null)} title="Sin color"
              className={`w-7 h-7 rounded-full border border-border text-slate-500 text-xs flex items-center justify-center ${
                color === null ? 'ring-2 ring-white' : ''
              }`}>∅</button>
          </div>
        </div>
      </div>

      {/* Vista previa */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Vista previa</label>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
          style={{ backgroundColor: (color ?? COLOR_DEFECTO) + '33', color: color ?? '#c4b5fd' }}>
          {icono && <span>{icono}</span>}
          {nombre.trim() || 'Nombre de la categoría'}
        </span>
      </div>

      {/* Categoría padre — buscador con árbol */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Categoría padre</label>
        <input className="input-field mb-1.5" placeholder="🔍 Buscar categoría padre…"
          value={busquedaPadre} onChange={e => setBusquedaPadre(e.target.value)} />
        <div className="border border-border rounded-lg max-h-32 overflow-y-auto p-1">
          <button type="button" onClick={() => setParentId(null)}
            className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
              parentId === null ? 'bg-brand-900/40 text-brand-200' : 'text-slate-400 hover:bg-surface'
            }`}>— Sin padre (raíz) —</button>
          {opcionesFiltradas.map(({ cat, nivel }) => (
            <button type="button" key={cat.id} onClick={() => setParentId(cat.id)}
              style={{ paddingLeft: `${(busquedaPadre ? 0 : nivel * 14) + 8}px` }}
              className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                parentId === cat.id ? 'bg-brand-900/40 text-brand-200' : 'text-slate-400 hover:bg-surface'
              }`}>
              {cat.icono ? `${cat.icono} ` : ''}{cat.nombre}
            </button>
          ))}
        </div>
      </div>
      {/* Imagen (Cloudinary) */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Imagen (Cloudinary)</label>
        {imagenUrl && (
          <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border mb-2">
            <img src={cldThumb(imagenUrl, 'f_auto,q_auto,c_fill,w_200,h_200')} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => setImagenUrl(null)}
              className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center">
              ×
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          disabled={subiendo}
          className="text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-600 file:text-white file:cursor-pointer hover:file:bg-brand-500"
        />
        {subiendo && <p className="text-slate-400 text-xs mt-1">Subiendo a Cloudinary…</p>}
        {uploadError && <p className="text-red-400 text-xs mt-1">{uploadError}</p>}
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

  // Conteo de productos por categoría (asignación directa) para el badge.
  const { data: productos = [] } = useQuery({
    queryKey: ['productos', 'conteo-categorias'],
    queryFn: () => productosApi.getAll(),
  })
  const conteo = new Map<number, number>()
  productos.forEach(p => (p.categorias ?? []).forEach(c => {
    conteo.set(c.id, (conteo.get(c.id) ?? 0) + 1)
  }))

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
                conteo={conteo}
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