import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productosApi } from '../api/index'
import { useCarrito } from '../store/carritoStore'

export default function ProductoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const agregar = useCarrito(s => s.agregar)
  const items = useCarrito(s => s.items)

  const { data: producto, isLoading, isError } = useQuery({
    queryKey: ['store-producto', id],
    queryFn: () => productosApi.getById(Number(id)),
    enabled: !!id,
  })

  const enCarrito = items.find(i => i.producto.id === Number(id))

  if (isLoading) return <div className="text-center py-20 text-gray-400">Cargando...</div>
  if (isError || !producto) return (
    <div className="text-center py-20">
      <p className="text-red-400 mb-4">Producto no encontrado</p>
      <button onClick={() => navigate('/')} className="text-orange-400 hover:text-orange-300">← Volver</button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1">
        ← Volver al menú
      </button>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="h-48 bg-gradient-to-br from-orange-900/30 to-gray-800 flex items-center justify-center">
          <span className="text-8xl">🍽️</span>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-3">
            <h1 className="text-2xl font-bold text-white">{producto.nombre}</h1>
            <span className="text-2xl font-bold text-orange-400">${producto.precio_base.toFixed(2)}</span>
          </div>

          {producto.descripcion && (
            <p className="text-gray-400 mb-4">{producto.descripcion}</p>
          )}

          {/* Categorías */}
          <div className="flex flex-wrap gap-2 mb-4">
            {producto.categorias.map(c => (
              <span key={c.id} className="text-xs bg-orange-900/30 text-orange-400 px-3 py-1 rounded-full">
                {c.nombre}
              </span>
            ))}
          </div>

          {/* Estado */}
          <div className="flex items-center gap-2 mb-6">
            <span className={`text-xs px-3 py-1 rounded-full ${
              producto.disponible
                ? 'bg-green-900/40 text-green-400'
                : 'bg-red-900/40 text-red-400'
            }`}>
              {producto.disponible ? '✓ Disponible' : '✗ No disponible'}
            </span>
            <span className="text-xs text-gray-500">
              {producto.es_manufacturado ? 'Producto artesanal' : 'Producto terminado'}
            </span>
          </div>

          {/* Botón agregar */}
          {producto.disponible ? (
            <button onClick={() => agregar(producto)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-lg transition-colors">
              {enCarrito ? `+ Agregar otro (${enCarrito.cantidad} en carrito)` : '+ Agregar al carrito'}
            </button>
          ) : (
            <button disabled className="w-full bg-gray-700 text-gray-500 font-bold py-4 rounded-xl text-lg cursor-not-allowed">
              No disponible
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
