import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { productosApi, categoriasApi, unidadesApi, ingredientesApi, uploadsApi } from '../../shared/api'
import { getApiErrorMessage } from '../../shared/api/errors'
import { cldThumb, publicIdFromUrl } from '../../shared/utils/cloudinary'
import type { Producto, ProductoCreate, ProductoUpdate, Categoria, UnidadMedida, Ingrediente } from '../../shared/types'
import Modal from '../../shared/components/Modal'
import { useAuthStore } from '../../store/authStore'
import { toggleCategoriaConCascada } from '../../shared/utils/categorias'

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

// Tarjeta contenedora reutilizable para agrupar secciones del formulario.
function SeccionCard({ titulo, children, className = '' }: { titulo: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">{titulo}</h3>
      {children}
    </div>
  )
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
  const [imagenesUrl, setImagenesUrl] = useState<string[]>(initial?.imagenes_url ?? [])
  const [subiendo, setSubiendo] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [validacionError, setValidacionError] = useState<string | null>(null)
  const [intentoSubmit, setIntentoSubmit] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const DESC_MAX = 280

  const subirArchivos = async (files: File[]) => {
    const validos = files.filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
    if (validos.length === 0) return
    setUploadError(null)
    setSubiendo(true)
    try {
      for (const file of validos) {
        const { secure_url } = await uploadsApi.subir(file, 'productos')
        setImagenesUrl(prev => [...prev, secure_url])
      }
    } catch (err) {
      setUploadError(getApiErrorMessage(err, 'Error al subir la imagen'))
    } finally {
      setSubiendo(false)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await subirArchivos(Array.from(e.target.files))
    e.target.value = ''   // permite volver a subir el mismo archivo
  }

  // Borra la imagen del CDN (DELETE /uploads/imagen/{public_id}) y la saca del form.
  // Best-effort: si Cloudinary falla, igual la quitamos localmente y avisamos.
  const quitarImagen = async (url: string) => {
    setImagenesUrl(prev => prev.filter(u => u !== url))
    const publicId = publicIdFromUrl(url)
    if (!publicId) return
    try {
      await uploadsApi.eliminar(publicId)
    } catch (err) {
      setUploadError(getApiErrorMessage(err, 'No se pudo borrar la imagen del CDN'))
    }
  }

  // Mueve la imagen al frente del array → se usa como principal (imagenes_url[0]).
  const marcarPrincipal = (url: string) =>
    setImagenesUrl(prev => [url, ...prev.filter(u => u !== url)])

  // Calculadora integrada
  const [costoOperativo, setCostoOperativo] = useState('0')
  const [margen, setMargen] = useState(30)

  const { data: ingredientesDisponibles = [] } = useQuery({
    queryKey: ['ingredientes'],
    queryFn: () => ingredientesApi.getAll(),
  })
  const [ingredientesSeleccionados, setIngredientesSeleccionados] = useState<IngredienteConCantidad[]>([])
  const [busquedaIng, setBusquedaIng] = useState('')
  // Sugerencias: ingredientes que coinciden con la búsqueda y aún NO están en la receta.
  const sugerencias = busquedaIng.trim()
    ? ingredientesDisponibles.filter(i =>
        i.nombre.toLowerCase().includes(busquedaIng.trim().toLowerCase()) &&
        !ingredientesSeleccionados.some(s => s.ingrediente.id === i.id))
    : []

  // Precarga la receta al EDITAR un manufacturado (una sola vez, cuando cargan los ingredientes).
  const precargado = useRef(false)
  useEffect(() => {
    if (precargado.current) return
    if (initial?.ingredientes?.length && ingredientesDisponibles.length) {
      const pre = initial.ingredientes
        .map(ie => {
          const full = ingredientesDisponibles.find(d => d.id === ie.ingrediente_id)
          return full ? { ingrediente: full, cantidad: ie.cantidad } : null
        })
        .filter((x): x is IngredienteConCantidad => x !== null)
      setIngredientesSeleccionados(pre)
      precargado.current = true
    }
  }, [initial, ingredientesDisponibles])

  // Cálculo automático en tiempo real
  const costoIngredientes = ingredientesSeleccionados.reduce((sum, { ingrediente, cantidad }) => {
    return sum + (ingrediente.precio_unitario ?? 0) * cantidad
  }, 0)
  const costoTotal = costoIngredientes + Number(costoOperativo || 0)
  const precioSugerido = costoTotal * (1 + margen / 100)
  const gananciaEstimada = Number(precioBase || 0) - costoTotal

  const aplanar = (cats: Categoria[], nivel = 0): { cat: Categoria; nivel: number }[] =>
    cats.flatMap(c => [{ cat: c, nivel }, ...aplanar(c.subcategorias ?? [], nivel + 1)])
  const opcionesCats = aplanar(categorias)
  const [busquedaCat, setBusquedaCat] = useState('')
  const catsFiltradas = busquedaCat.trim()
    ? opcionesCats.filter(({ cat }) => cat.nombre.toLowerCase().includes(busquedaCat.trim().toLowerCase()))
    : opcionesCats
  const catsSeleccionadas = opcionesCats.filter(({ cat }) => categoriaIds.includes(cat.id)).map(o => o.cat)

  const toggleCategoria = (id: number) => {
    setCategoriaIds(prev => toggleCategoriaConCascada(id, categorias, prev))
  }

  const agregarIngrediente = (ing: Ingrediente) => {
    setIngredientesSeleccionados(prev =>
      prev.some(i => i.ingrediente.id === ing.id) ? prev : [...prev, { ingrediente: ing, cantidad: 1 }]
    )
    setBusquedaIng('')
  }

  const quitarIngrediente = (id: number) =>
    setIngredientesSeleccionados(prev => prev.filter(i => i.ingrediente.id !== id))

  const setCantidad = (ingredienteId: number, cantidad: number) => {
    setIngredientesSeleccionados(prev =>
      prev.map(i => i.ingrediente.id === ingredienteId ? { ...i, cantidad } : i)
    )
  }

  const getUnidadSimbolo = (id: number | null | undefined) =>
    id ? unidades.find(u => u.id === id)?.simbolo ?? '' : ''

  const aplicarPrecioSugerido = () => setPrecioBase(precioSugerido.toFixed(2))

  // Validación visual
  const nombreInvalido = intentoSubmit && nombre.trim().length < 2
  const precioInvalido = intentoSubmit && (!precioBase || Number(precioBase) <= 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIntentoSubmit(true)
    setValidacionError(null)

    if (nombre.trim().length < 2 || !precioBase || Number(precioBase) <= 0) return
    if (esManufacturado && ingredientesSeleccionados.length === 0) {
      setValidacionError('Debe cargar al menos un ingrediente')
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
      ingredientes: esManufacturado
        ? ingredientesSeleccionados.map(i => ({ ingrediente_id: i.ingrediente.id, cantidad: i.cantidad }))
        : [],
      imagenes_url: imagenesUrl,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {}
        <div className="lg:col-span-2 space-y-4">

          {}
          <SeccionCard titulo="📝 Información básica">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nombre del producto *</label>
                <input
                  className={`input-field text-base ${nombreInvalido ? 'border-red-500/70 focus:border-red-500' : ''}`}
                  value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Pizza Margarita" />
                {nombreInvalido && <p className="text-red-400 text-xs mt-1">Ingresá un nombre (mín. 2 caracteres)</p>}
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-400">Descripción</label>
                  <span className={`text-xs ${descripcion.length > DESC_MAX ? 'text-red-400' : 'text-slate-500'}`}>
                    {descripcion.length}/{DESC_MAX}
                  </span>
                </div>
                <textarea className="input-field resize-none" rows={2} maxLength={DESC_MAX}
                  value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  placeholder="Descripción opcional del producto…" />
              </div>

              {}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de producto</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { val: false, label: '📦 Terminado', desc: 'Stock propio' },
                    { val: true, label: '👨‍🍳 Manufacturado', desc: 'Receta de ingredientes' },
                  ] as const).map(opt => (
                    <button key={String(opt.val)} type="button"
                      onClick={() => {
                        setEsManufacturado(opt.val)
                        setValidacionError(null)
                        if (!opt.val) setIngredientesSeleccionados([])
                      }}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                        esManufacturado === opt.val
                          ? 'border-brand-500 bg-brand-900/30 text-slate-100'
                          : 'border-border bg-surface text-slate-400 hover:border-slate-600'
                      }`}>
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {}
              {!esManufacturado && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Stock inicial</label>
                    <input className="input-field" type="number" min="0" value={stockCantidad}
                      onChange={e => setStockCantidad(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Unidad de medida</label>
                    <select className="input-field" value={unidadVentaId ?? ''}
                      onChange={e => setUnidadVentaId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">— Por pieza —</option>
                      {unidades.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</option>)}
                    </select>
                  </div>
                </div>
              )}
              {esManufacturado && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Unidad de venta</label>
                  <select className="input-field" value={unidadVentaId ?? ''}
                    onChange={e => setUnidadVentaId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">— Por pieza —</option>
                    {unidades.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</option>)}
                  </select>
                </div>
              )}
            </div>
          </SeccionCard>

          {}
          {esManufacturado && (
            <SeccionCard titulo="🥘 Receta">
              {}
              <div className="relative mb-3">
                <input
                  className="input-field"
                  placeholder="🔍 Buscar ingrediente para agregar…"
                  value={busquedaIng}
                  onChange={e => setBusquedaIng(e.target.value)}
                />
                {sugerencias.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {sugerencias.map(ing => (
                      <button key={ing.id} type="button" onClick={() => agregarIngrediente(ing)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-brand-900/30 transition-colors">
                        <span className="text-sm text-slate-200 flex items-center gap-1.5">
                          {ing.nombre}
                          {ing.es_alergeno && <span title="Alérgeno" className="text-amber-400">🌾</span>}
                        </span>
                        <span className="text-xs text-slate-500 shrink-0">
                          ${(ing.precio_unitario ?? 0).toFixed(2)} / {getUnidadSimbolo(ing.unidad_medida_id) || 'u'}
                          <span className="ml-2 text-brand-400">+ Agregar</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {ingredientesDisponibles.length === 0 && (
                  <p className="text-slate-500 text-xs mt-1">No hay ingredientes cargados.</p>
                )}
              </div>

              {}
              {ingredientesSeleccionados.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4 border border-dashed border-border rounded-lg">
                  Buscá y agregá ingredientes para armar la receta.
                </p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface text-left text-xs text-slate-400 uppercase tracking-wider">
                        <th className="py-2 px-3 font-semibold">Ingrediente</th>
                        <th className="py-2 px-2 font-semibold">Cantidad</th>
                        <th className="py-2 px-2 font-semibold text-right">Costo</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ingredientesSeleccionados.map(({ ingrediente, cantidad }) => {
                        const simbolo = getUnidadSimbolo(ingrediente.unidad_medida_id) || 'u'
                        const subtotal = (ingrediente.precio_unitario ?? 0) * cantidad
                        return (
                          <tr key={ingrediente.id}>
                            <td className="py-2 px-3 text-slate-200 flex items-center gap-1.5">
                              {ingrediente.nombre}
                              {ingrediente.es_alergeno && <span title="Alérgeno" className="text-amber-400">🌾</span>}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1.5">
                                <input type="number" min="0.001" step="0.001" value={cantidad}
                                  onChange={e => setCantidad(ingrediente.id, Number(e.target.value))}
                                  className="input-field w-20 text-right text-sm py-1" />
                                <span className="text-xs text-slate-400 w-7">{simbolo}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right text-brand-400 font-medium">${subtotal.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right">
                              <button type="button" onClick={() => quitarIngrediente(ingrediente.id)}
                                title="Quitar" className="text-red-400 hover:text-red-300">🗑️</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-surface border-t border-border">
                        <td className="py-2 px-3 text-xs font-semibold text-slate-400 uppercase" colSpan={2}>Total receta</td>
                        <td className="py-2 px-2 text-right font-bold text-slate-100" colSpan={2}>${costoIngredientes.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {validacionError && (
                <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg mt-3">⚠️ {validacionError}</p>
              )}
            </SeccionCard>
          )}

          {}
          <SeccionCard titulo="🏷️ Categorías">
            {catsSeleccionadas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {catsSeleccionadas.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-900/50 text-brand-200 rounded-full text-xs">
                    {c.nombre}
                    <button type="button" onClick={() => toggleCategoria(c.id)} className="hover:text-white">✕</button>
                  </span>
                ))}
              </div>
            )}
            <input className="input-field mb-2" placeholder="🔍 Filtrar categorías…"
              value={busquedaCat} onChange={e => setBusquedaCat(e.target.value)} />
            <div className="border border-border rounded-lg p-2 max-h-40 overflow-y-auto space-y-0.5">
              {catsFiltradas.length === 0
                ? <p className="text-slate-500 text-xs px-2 py-1">Sin coincidencias</p>
                : catsFiltradas.map(({ cat, nivel }) => (
                  <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-surface/50 rounded px-2 py-0.5"
                    style={{ paddingLeft: `${(busquedaCat ? 0 : nivel * 16) + 8}px` }}>
                    <input type="checkbox" checked={categoriaIds.includes(cat.id)}
                      onChange={() => toggleCategoria(cat.id)} className="w-3.5 h-3.5 accent-brand-600" />
                    <span className="text-sm text-slate-300">{cat.nombre}</span>
                  </label>
                ))
              }
            </div>
          </SeccionCard>
        </div>

        {}
        <div className="lg:col-span-1 space-y-4">

          {}
          {esManufacturado && (
            <SeccionCard titulo="💰 Calculadora de precio">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Costo ingredientes</span>
                  <span className="text-slate-200">${costoIngredientes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>+ Costos operativos</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">$</span>
                    <input type="number" min="0" step="0.01" value={costoOperativo}
                      onChange={e => setCostoOperativo(e.target.value)}
                      className="w-20 bg-surface border border-border rounded px-2 py-0.5 text-white text-sm text-right focus:outline-none focus:border-brand-500" />
                  </div>
                </div>
                <div className="flex justify-between text-slate-200 border-t border-border pt-1.5 font-medium">
                  <span>= Costo total</span>
                  <span>${costoTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-slate-400">Margen de ganancia</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="1000" value={margen}
                      onChange={e => setMargen(Number(e.target.value))}
                      className="w-14 bg-surface border border-border rounded px-1.5 py-0.5 text-brand-400 font-bold text-sm text-center focus:outline-none focus:border-brand-500" />
                    <span className="text-brand-400 font-bold text-sm">%</span>
                  </div>
                </div>
                <input type="range" min="0" max="300" value={margen}
                  onChange={e => setMargen(Number(e.target.value))} className="w-full accent-brand-600" />
              </div>

              <div className="flex items-center justify-between bg-brand-900/20 border border-brand-800/50 rounded-lg px-3 py-2.5 mt-3">
                <div>
                  <p className="text-xs text-slate-400">Precio sugerido</p>
                  <p className="text-xl font-bold text-brand-400">${precioSugerido.toFixed(2)}</p>
                </div>
                <button type="button" onClick={aplicarPrecioSugerido} className="btn-primary py-1.5 px-3 text-xs">
                  Usar →
                </button>
              </div>
            </SeccionCard>
          )}

          {}
          <SeccionCard titulo="🖼️ Imágenes">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); subirArchivos(Array.from(e.dataTransfer.files)) }}
              className={`cursor-pointer border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                dragOver ? 'border-brand-500 bg-brand-900/20' : 'border-border hover:border-slate-600'
              }`}>
              <div className="text-2xl mb-1">📁</div>
              <p className="text-xs text-slate-400">Arrastrá imágenes acá o hacé clic</p>
              <p className="text-[10px] text-slate-600 mt-1">JPG / PNG / WEBP · recomendado 800×800px</p>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
                onChange={handleFile} disabled={subiendo} className="hidden" />
            </div>
            {subiendo && <p className="text-slate-400 text-xs mt-2">Subiendo a Cloudinary…</p>}
            {uploadError && <p className="text-red-400 text-xs mt-2">{uploadError}</p>}

            {imagenesUrl.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {imagenesUrl.map((url, idx) => (
                  <div key={url} className={`group relative aspect-square rounded-lg overflow-hidden border ${
                    idx === 0 ? 'border-brand-500' : 'border-border'
                  }`}>
                    <img src={cldThumb(url, 'f_auto,q_auto,c_fill,w_160,h_160')} alt="" className="w-full h-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute top-0.5 left-0.5 bg-brand-600 text-white text-[10px] px-1 rounded">🌟 Principal</span>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {idx !== 0 && (
                        <button type="button" onClick={() => marcarPrincipal(url)} title="Marcar principal"
                          className="text-white text-sm hover:scale-110">🌟</button>
                      )}
                      <button type="button" onClick={() => quitarImagen(url)} title="Eliminar"
                        className="text-white text-sm hover:scale-110">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SeccionCard>

          {}
          <SeccionCard titulo="✅ Resumen" className="lg:sticky lg:top-2">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Precio de venta final *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input type="number" min="0" step="0.01" value={precioBase}
                    onChange={e => setPrecioBase(e.target.value)}
                    className={`input-field pl-6 text-lg font-bold ${precioInvalido ? 'border-red-500/70 focus:border-red-500' : ''}`}
                    placeholder="0.00" />
                </div>
                {precioInvalido && <p className="text-red-400 text-xs mt-1">Ingresá un precio mayor a 0</p>}
              </div>

              {esManufacturado && Number(precioBase) > 0 && (
                <p className={`text-xs ${gananciaEstimada >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  💰 Ganancia estimada: <span className="font-semibold">${gananciaEstimada.toFixed(2)}</span> por unidad
                </p>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={disponible} onChange={e => setDisponible(e.target.checked)}
                  className="w-4 h-4 accent-brand-600" />
                <span className="text-sm text-slate-300">Disponible para la venta</span>
              </label>

              {error && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={isLoading}>
                {isLoading && (
                  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {isLoading ? 'Guardando…' : initial ? 'Actualizar producto' : 'Crear producto'}
              </button>
            </div>
          </SeccionCard>
        </div>
      </div>
    </form>
  )
}

// ── Helpers visuales ──────────────────────────────────────────────────────

function Thumb({ url, alt, size = 'w-10 h-10' }: { url?: string | null; alt: string; size?: string }) {
  return url
    ? <img src={cldThumb(url, 'f_auto,q_auto,c_fill,w_80,h_80')} alt={alt}
        className={`${size} rounded-lg object-cover border border-border`} />
    : <div className={`${size} rounded-lg bg-slate-800 flex items-center justify-center text-slate-500`}>🍽️</div>
}

function SwitchDisponible({ on, disabled, onToggle }: { on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      title={on ? 'Disponible — clic para desactivar' : 'Agotado — clic para activar'}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        on ? 'bg-green-500' : 'bg-slate-600'
      } ${disabled ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        on ? 'translate-x-[18px]' : 'translate-x-0.5'
      }`} />
    </button>
  )
}

// ── Página principal ──────────────────────────────────────────────────────

export default function ProductosPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.user?.rol ?? null)
  const esAdmin = role === 'ADMIN'

  const [search, setSearch] = useState('')
  const [filtroDisponible, setFiltroDisponible] = useState<string>('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [mutError, setMutError] = useState<string | null>(null)
  const [vista, setVista] = useState<'tabla' | 'tarjetas'>('tabla')

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
        {}
        <div className="ml-auto flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
          {(['tabla', 'tarjetas'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                vista === v ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {v === 'tabla' ? '☰ Tabla' : '▦ Tarjetas'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-slate-400">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los productos.</p>}
      {!isLoading && !isError && (
        vista === 'tabla' ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 w-12"></th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Producto</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Categoría</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {productos.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500">Sin resultados</td></tr>
              )}
              {productos.map(p => (
                <tr key={p.id} className="hover:bg-surface/50 transition-colors">
                  <td className="py-3 pr-2"><Thumb url={p.imagenes_url?.[0]} alt={p.nombre} /></td>
                  <td className="py-3">
                    <div className="font-medium text-slate-100">{p.nombre}</div>
                    {p.descripcion && <div className="text-xs text-slate-500 truncate max-w-xs">{p.descripcion}</div>}
                    <div className="text-brand-400 text-xs font-medium">${(p.precio_base ?? 0).toFixed(2)}</div>
                  </td>
                  <td className="py-3">
                    {p.es_manufacturado
                      ? <span title="Depende de los ingredientes" className="text-lg cursor-help" aria-label="Manufacturado">👨‍🍳</span>
                      : <span className={`font-medium ${(p.stock_cantidad ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.stock_cantidad ?? 0} {getUnidadSimbolo(p.unidad_venta_id) === '—' ? 'u' : getUnidadSimbolo(p.unidad_venta_id)}
                        </span>
                    }
                  </td>
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
                    <div className="flex items-center gap-2">
                      <SwitchDisponible on={p.disponible} disabled={!esAdmin}
                        onToggle={() => esAdmin && toggleDisponible.mutate({ id: p.id, disponible: !p.disponible })} />
                      <span className={`text-xs ${p.disponible ? 'text-green-400' : 'text-slate-500'}`}>
                        {p.disponible ? 'Disponible' : 'Agotado'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2 flex-wrap justify-end">
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
        ) : (
        productos.length === 0 ? (
          <div className="card text-center py-10 text-slate-500">Sin resultados</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            {productos.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
                <div className="relative h-32 bg-slate-800">
                  {p.imagenes_url?.[0]
                    ? <img src={cldThumb(p.imagenes_url[0], 'f_auto,q_auto,c_fill,w_400,h_240')} alt={p.nombre} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl text-slate-600">🍽️</div>}
                  <span className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium ${
                    p.es_manufacturado ? 'bg-purple-900/70 text-purple-200' : 'bg-slate-900/70 text-slate-300'
                  }`}>{p.es_manufacturado ? '👨‍🍳 Manuf.' : 'Terminado'}</span>
                </div>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div className="font-medium text-slate-100 truncate">{p.nombre}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-brand-400 font-bold">${(p.precio_base ?? 0).toFixed(2)}</span>
                    {p.es_manufacturado
                      ? <span title="Depende de los ingredientes" className="cursor-help">👨‍🍳</span>
                      : <span className={`text-xs font-medium ${(p.stock_cantidad ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.stock_cantidad ?? 0} {getUnidadSimbolo(p.unidad_venta_id) === '—' ? 'u' : getUnidadSimbolo(p.unidad_venta_id)}
                        </span>}
                  </div>
                  <div className="flex items-center justify-between pt-2 mt-auto border-t border-border">
                    <SwitchDisponible on={p.disponible} disabled={!esAdmin}
                      onToggle={() => esAdmin && toggleDisponible.mutate({ id: p.id, disponible: !p.disponible })} />
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => navigate(`/productos/${p.id}`)} className="text-slate-400 hover:text-slate-100">Ver</button>
                      {esAdmin && <button onClick={() => { setEditing(p); setMutError(null); setModalOpen(true) }} className="text-brand-400 hover:text-brand-300">Editar</button>}
                      {esAdmin && <button onClick={() => { if (confirm('¿Eliminar?')) deleteMut.mutate(p.id) }} className="text-red-400 hover:text-red-300">Eliminar</button>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
        )
      )}

      {esAdmin && (
        <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setMutError(null) }}
          title={editing ? 'Editar producto' : 'Nuevo producto'} wide>
          <ProductoForm
            key={editing?.id ?? 'nuevo'}
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