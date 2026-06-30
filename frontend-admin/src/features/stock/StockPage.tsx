import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productosApi, ingredientesApi } from '../../shared/api'
import { getApiErrorMessage } from '../../shared/api/errors'
import { cldThumb } from '../../shared/utils/cloudinary'
import type { Producto, Ingrediente } from '../../shared/types'

const UMBRAL_BAJO = 10
type FiltroUrgencia = 'todos' | 'sin' | 'bajo' | 'ok'

interface EstadoIng {
  sinReceta: boolean
  ok: boolean              // alcanza al menos para 1 unidad de todo
  falta: string | null     // primer ingrediente que no alcanza ni para 1
  max: number              // unidades producibles con el stock actual de insumos
  limitante: string | null // ingrediente que limita la producción
}

function colorStock(n: number): string {
  if (n <= 0) return 'text-red-400'
  if (n < UMBRAL_BAJO) return 'text-amber-400'
  return 'text-slate-100'
}

// Calcula el estado de insumos de un producto manufacturado.
function calcularEstadoIng(p: Producto, ingMap: Map<number, Ingrediente>): EstadoIng {
  const items = p.ingredientes ?? []
  if (items.length === 0) return { sinReceta: true, ok: false, falta: null, max: 0, limitante: null }
  let max = Infinity
  let limitante: string | null = null
  let falta: string | null = null
  for (const it of items) {
    const stock = ingMap.get(it.ingrediente_id)?.stock_disponible ?? 0
    const porUnidad = it.cantidad || 0
    if (porUnidad > 0) {
      const posibles = Math.floor(stock / porUnidad)
      if (posibles < max) { max = posibles; limitante = it.nombre }
      if (stock < porUnidad && falta === null) falta = it.nombre
    }
  }
  if (!Number.isFinite(max)) max = 0
  return { sinReceta: false, ok: falta === null, falta, max, limitante }
}

// Miniatura del producto (o ícono de cubiertos).
function Thumb({ url, alt }: { url?: string | null; alt: string }) {
  return url
    ? <img src={cldThumb(url, 'f_auto,q_auto,c_fill,w_80,h_80')} alt={alt}
        className="w-10 h-10 rounded-lg object-cover border border-border" />
    : <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">🍽️</div>
}

interface FilaProps {
  producto: Producto
  estadoIng: EstadoIng | null
  valor: number
  sucio: boolean
  onDelta: (delta: number) => void
  onSet: (n: number) => void
}

function FilaStock({ producto, estadoIng, valor, sucio, onDelta, onSet }: FilaProps) {
  const queryClient = useQueryClient()
  const dispMut = useMutation({
    mutationFn: (d: boolean) => productosApi.patchDisponibilidad(producto.id, d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-productos'] }),
  })
  const man = producto.es_manufacturado

  return (
    <tr className={`hover:bg-surface/50 transition-colors ${sucio ? 'bg-brand-900/10' : ''}`}>
      {}
      <td className="py-3">
        <div className="flex items-center gap-3">
          <Thumb url={producto.imagenes_url?.[0]} alt={producto.nombre} />
          <div>
            <div className="font-medium text-slate-100">{producto.nombre}</div>
            <div className="text-xs text-slate-500">{man ? '👨‍🍳 Manufacturado' : 'Terminado'}</div>
          </div>
        </div>
      </td>

      {}
      <td className="py-3">
        {man ? (
          estadoIng?.sinReceta ? (
            <span className="text-slate-600 text-xs italic">Sin receta</span>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-bold ${colorStock(estadoIng?.max ?? 0)}`}>~{estadoIng?.max ?? 0}</span>
              <span className="text-xs text-slate-500">und. posibles</span>
            </div>
          )
        ) : (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onDelta(-10)}
              className="px-1.5 h-7 rounded bg-card text-slate-400 hover:bg-border text-xs">−10</button>
            <button type="button" onClick={() => onDelta(-1)}
              className="w-7 h-7 rounded bg-card text-slate-300 hover:bg-border font-bold">−</button>
            <input
              type="number" min="0"
              className={`w-16 bg-card border border-border rounded text-center py-1 font-bold focus:outline-none focus:border-brand-500 ${colorStock(valor)}`}
              value={valor}
              onChange={e => onSet(Math.max(0, Number(e.target.value)))}
            />
            <button type="button" onClick={() => onDelta(1)}
              className="w-7 h-7 rounded bg-card text-slate-300 hover:bg-border font-bold">+</button>
            <button type="button" onClick={() => onDelta(10)}
              className="px-1.5 h-7 rounded bg-card text-slate-400 hover:bg-border text-xs">+10</button>
          </div>
        )}
      </td>

      {}
      <td className="py-3">
        {!man ? (
          <span className="text-slate-600 text-xs">—</span>
        ) : estadoIng?.sinReceta ? (
          <span className="text-xs text-slate-500">Sin ingredientes cargados</span>
        ) : (
          <div>
            {estadoIng?.ok ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded-full">
                ✅ Ingredientes OK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded-full">
                ⚠️ Falta {estadoIng?.falta}
              </span>
            )}
            {estadoIng && estadoIng.limitante && (
              <div className={`text-xs mt-1 ${estadoIng.max < UMBRAL_BAJO ? 'text-amber-400' : 'text-slate-500'}`}>
                Alcanza para ~{estadoIng.max} · limita {estadoIng.limitante}
              </div>
            )}
          </div>
        )}
      </td>

      {}
      <td className="py-3 text-right">
        <div className="inline-flex items-center gap-2">
          <span className={`text-xs ${producto.disponible ? 'text-green-400' : 'text-slate-500'}`}>
            {producto.disponible ? 'Disponible' : 'Agotado'}
          </span>
          <button type="button" role="switch" aria-checked={producto.disponible}
            onClick={() => dispMut.mutate(!producto.disponible)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              producto.disponible ? 'bg-brand-600' : 'bg-slate-600'
            }`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              producto.disponible ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function StockPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<FiltroUrgencia>('todos')
  const [cambios, setCambios] = useState<Record<number, number>>({})
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  const { data: productos = [], isLoading, isError } = useQuery({
    queryKey: ['stock-productos'],
    queryFn: () => productosApi.getAll(),
  })
  const { data: ingredientes = [] } = useQuery({
    queryKey: ['ingredientes'],
    queryFn: () => ingredientesApi.getAll(),
  })
  const ingMap = new Map(ingredientes.map(i => [i.id, i]))

  // Nivel efectivo de stock: terminado → stock_cantidad; manufacturado → unidades producibles.
  const conInfo = productos.map(p => {
    const estadoIng = p.es_manufacturado ? calcularEstadoIng(p, ingMap) : null
    const nivel = p.es_manufacturado ? (estadoIng?.max ?? 0) : (p.stock_cantidad ?? 0)
    return { p, estadoIng, nivel }
  })

  const porBusqueda = conInfo.filter(({ p }) =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const conteo = {
    sin: porBusqueda.filter(x => x.nivel <= 0).length,
    bajo: porBusqueda.filter(x => x.nivel > 0 && x.nivel < UMBRAL_BAJO).length,
    ok: porBusqueda.filter(x => x.nivel >= UMBRAL_BAJO).length,
  }

  const filtrados = porBusqueda.filter(x => {
    if (filtro === 'sin') return x.nivel <= 0
    if (filtro === 'bajo') return x.nivel > 0 && x.nivel < UMBRAL_BAJO
    if (filtro === 'ok') return x.nivel >= UMBRAL_BAJO
    return true
  })

  const valorActual = (p: Producto) => cambios[p.id] ?? p.stock_cantidad ?? 0
  const setStock = (p: Producto, n: number) => {
    const limpio = Math.max(0, Math.round(n))
    setCambios(prev => {
      const next = { ...prev }
      if (limpio === (p.stock_cantidad ?? 0)) delete next[p.id]   // volvió al original → sin cambio
      else next[p.id] = limpio
      return next
    })
  }

  const nCambios = Object.keys(cambios).length

  const guardarTodos = async () => {
    setGuardando(true)
    setErrorGuardar(null)
    try {
      for (const [idStr, val] of Object.entries(cambios)) {
        await productosApi.patchStock(Number(idStr), val)
      }
      setCambios({})
      queryClient.invalidateQueries({ queryKey: ['stock-productos'] })
    } catch (e) {
      setErrorGuardar(getApiErrorMessage(e, 'No se pudieron guardar algunos cambios'))
    } finally {
      setGuardando(false)
    }
  }

  const FiltroBtn = ({ id, label, dot, count }: { id: FiltroUrgencia; label: string; dot: string; count?: number }) => (
    <button onClick={() => setFiltro(filtro === id ? 'todos' : id)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 ${
        filtro === id ? 'border-brand-500 bg-brand-900/30 text-slate-100' : 'border-border bg-surface text-slate-400 hover:border-slate-600'
      }`}>
      <span>{dot}</span>{label}
      {count !== undefined && <span className="text-xs bg-card px-1.5 rounded-full">{count}</span>}
    </button>
  )

  return (
    <div className={nCambios > 0 ? 'pb-24' : ''}>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-slate-100">Gestión de stock</h1>
        <p className="text-slate-400 text-sm mt-1">Ajustá existencias y disponibilidad</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          className="input-field max-w-xs"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <FiltroBtn id="sin" label="Sin stock" dot="🔴" count={conteo.sin} />
          <FiltroBtn id="bajo" label="Stock bajo" dot="🟡" count={conteo.bajo} />
          <FiltroBtn id="ok" label="Disponibles" dot="🟢" count={conteo.ok} />
        </div>
      </div>

      {isLoading && <p className="text-slate-400">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los productos.</p>}

      {!isLoading && !isError && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Producto</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Insumos</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Disponibilidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-slate-500">Sin resultados</td></tr>
              )}
              {filtrados.map(({ p, estadoIng }) => (
                <FilaStock
                  key={p.id}
                  producto={p}
                  estadoIng={estadoIng}
                  valor={valorActual(p)}
                  sucio={cambios[p.id] !== undefined}
                  onDelta={d => setStock(p, valorActual(p) + d)}
                  onSet={n => setStock(p, n)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {}
      {nCambios > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-card border border-brand-700/60 rounded-xl shadow-2xl px-5 py-3">
          <span className="text-sm text-slate-200">
            Tenés <span className="font-bold text-brand-400">{nCambios}</span> {nCambios === 1 ? 'cambio' : 'cambios'} sin guardar
          </span>
          {errorGuardar && <span className="text-red-400 text-xs">{errorGuardar}</span>}
          <button onClick={() => { setCambios({}); setErrorGuardar(null) }}
            className="btn-secondary py-1.5 px-3 text-sm" disabled={guardando}>
            Descartar
          </button>
          <button onClick={guardarTodos} className="btn-primary py-1.5 px-4 text-sm flex items-center gap-2" disabled={guardando}>
            {guardando && <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {guardando ? 'Guardando…' : 'Guardar todos'}
          </button>
        </div>
      )}
    </div>
  )
}
