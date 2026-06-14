/**
 * StockPage — gestión de stock para el rol STOCK (y ADMIN).
 *
 * Permite ajustar `stock_cantidad` (PATCH /productos/{id}/stock) y togglear
 * la disponibilidad (PATCH /productos/{id}/disponibilidad). No expone precios
 * ni el CRUD completo: el rol STOCK solo controla existencias.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productosApi } from '../../shared/api'
import { getApiErrorMessage } from '../../shared/api/errors'
import type { Producto } from '../../shared/types'

function FilaStock({ producto }: { producto: Producto }) {
  const queryClient = useQueryClient()
  const [valor, setValor] = useState(String(producto.stock_cantidad ?? 0))
  const [error, setError] = useState<string | null>(null)

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['stock-productos'] })

  const stockMut = useMutation({
    mutationFn: (n: number) => productosApi.patchStock(producto.id, n),
    onSuccess: () => { setError(null); invalidar() },
    onError: (e) => setError(getApiErrorMessage(e, 'No se pudo actualizar el stock')),
  })

  const dispMut = useMutation({
    mutationFn: (d: boolean) => productosApi.patchDisponibilidad(producto.id, d),
    onSuccess: invalidar,
  })

  const sucio = valor !== String(producto.stock_cantidad ?? 0)
  const guardar = () => {
    const n = Number(valor)
    if (Number.isNaN(n) || n < 0) { setError('Stock inválido'); return }
    stockMut.mutate(n)
  }

  return (
    <tr className="hover:bg-surface/50 transition-colors">
      <td className="py-3">
        <div className="font-medium text-slate-100">{producto.nombre}</div>
        {producto.es_manufacturado && (
          <span className="text-xs text-slate-500 italic">Manufacturado (en base a insumos)</span>
        )}
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <input
            type="number" min="0"
            className="input-field w-24 text-right py-1"
            value={valor}
            disabled={producto.es_manufacturado}
            onChange={e => setValor(e.target.value)}
          />
          <button
            onClick={guardar}
            disabled={!sucio || stockMut.isPending || producto.es_manufacturado}
            className="btn-primary py-1 px-3 text-xs disabled:opacity-40"
          >
            {stockMut.isPending ? '…' : 'Guardar'}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </td>
      <td className="py-3">
        <button
          onClick={() => dispMut.mutate(!producto.disponible)}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
            producto.disponible
              ? 'bg-green-900/40 text-green-300 hover:bg-green-900/70'
              : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
          }`}
        >
          {producto.disponible ? 'Disponible' : 'No disponible'}
        </button>
      </td>
    </tr>
  )
}

export default function StockPage() {
  const [search, setSearch] = useState('')

  const { data: productos = [], isLoading, isError } = useQuery({
    queryKey: ['stock-productos'],
    queryFn: () => productosApi.getAll(),
  })

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-slate-100">Gestión de stock</h1>
        <p className="text-slate-400 text-sm mt-1">Ajustá existencias y disponibilidad</p>
      </div>

      <input
        className="input-field max-w-xs mb-5"
        placeholder="Buscar por nombre..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {isLoading && <p className="text-slate-400">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los productos.</p>}

      {!isLoading && !isError && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Producto</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Disponibilidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.length === 0 && (
                <tr><td colSpan={3} className="py-8 text-center text-slate-500">Sin resultados</td></tr>
              )}
              {filtrados.map(p => <FilaStock key={p.id} producto={p} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
