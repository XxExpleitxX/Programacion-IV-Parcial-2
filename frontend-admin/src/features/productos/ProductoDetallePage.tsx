import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productosApi } from '../../shared/api'
import { useAuth } from '../../context/AuthContext'

export default function ProductoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role } = useAuth()
  const esAdmin = role === 'ADMIN'

  const { data: producto, isLoading, isError } = useQuery({
    queryKey: ['producto', id],
    queryFn: () => productosApi.getById(Number(id)),
    enabled: !!id,
  })

  if (isLoading) return <p className="text-slate-400">Cargando producto...</p>
  if (isError || !producto) return (
    <div className="text-center py-20">
      <p className="text-red-400 text-lg mb-4">Producto no encontrado</p>
      <button onClick={() => navigate('/productos')} className="btn-secondary">← Volver</button>
    </div>
  )

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/productos')}
        className="text-slate-400 hover:text-slate-100 text-sm mb-6 flex items-center gap-1 transition-colors">
        ← Volver a productos
      </button>

      <div className="card mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="font-display text-3xl text-slate-100">{producto.nombre}</h1>
            {producto.descripcion && <p className="text-slate-400 mt-2">{producto.descripcion}</p>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-brand-400">${(producto.precio_base ?? 0).toFixed(2)}</div>
            <div className="text-slate-400 text-sm mt-1">Stock: {producto.stock_cantidad ?? 0}</div>
            <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-medium ${
              producto.disponible ? 'bg-green-900/40 text-green-300' : 'bg-slate-800 text-slate-500'
            }`}>
              {producto.disponible ? 'Disponible' : 'No disponible'}
            </span>
          </div>
        </div>

        {esAdmin && (
          <div className="flex gap-2 mb-4">
            <button onClick={() => navigate('/productos')} className="btn-secondary py-1 px-3">
              ← Editar desde listado
            </button>
          </div>
        )}

        <div className="border-t border-border pt-4 mt-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Categorías ({(producto.categorias ?? []).length})
          </h2>
          {(producto.categorias ?? []).length === 0
            ? <p className="text-slate-500 text-sm">Sin categorías asignadas</p>
            : (
              <div className="flex flex-wrap gap-2">
                {producto.categorias.map(c => (
                  <div key={c.id} className="px-3 py-1.5 bg-brand-900/50 border border-brand-700/50 rounded-lg">
                    <div className="text-brand-300 text-sm font-medium">{c.nombre}</div>
                    {c.descripcion && <div className="text-brand-400/70 text-xs">{c.descripcion}</div>}
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      <div className="card bg-surface/50 text-sm text-slate-400">
        <strong className="text-slate-300">Resumen:</strong> El producto{' '}
        <em className="text-slate-200">{producto.nombre}</em>
        {(producto.categorias ?? []).length > 0
          ? <> pertenece a <strong className="text-brand-300">{producto.categorias.map(c => c.nombre).join(', ')}</strong></>
          : <> no tiene categorías asignadas</>}.
      </div>
    </div>
  )
}