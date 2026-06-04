import { useNavigate } from 'react-router-dom'
import type { Producto } from '../types/index'
import { useCarrito } from '../store/carritoStore'

interface Props {
  producto: Producto
}

export default function ProductoCard({ producto }: Props) {
  const navigate = useNavigate()
  const agregar = useCarrito(s => s.agregar)

  return (
    <div className="group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300">
      
      {/* === IMAGEN === */}
      <div className="relative h-40 bg-gray-800 overflow-hidden">
        {producto.imagen_url ? (
          <img
            src={producto.imagen_url}
            alt={producto.nombre}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-900/20 to-gray-800">
            <span className="text-4xl grayscale opacity-60">🍽️</span>
          </div>
        )}
        
        {/* Badge de stock sobre la imagen */}
        {!producto.disponible && (
          <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center backdrop-blur-[2px]">
            <span className="bg-red-500/90 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
              Agotado
            </span>
          </div>
        )}
      </div>

      {/* === CONTENIDO === */}
      <div className="p-4 space-y-3">
        
        {/* Título */}
        <h3 className="font-semibold text-white text-sm leading-tight line-clamp-1">
          {producto.nombre}
        </h3>

        {/* Descripción */}
        {producto.descripcion && (
          <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed">
            {producto.descripcion}
          </p>
        )}

        {/* Categorías */}
        {producto.categorias && producto.categorias.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {producto.categorias.slice(0, 2).map(c => (
              <span key={c.id} className="text-[10px] uppercase tracking-wide font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
                {c.nombre}
              </span>
            ))}
          </div>
        )}

        {/* Precio y Acciones */}
        <div className="flex items-end justify-between pt-2 border-t border-gray-800">
          <div className="flex flex-col">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">Precio</span>
            <span className="text-orange-400 font-extrabold text-xl leading-none">
              ${producto.precio_base.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón Ver más */}
            <button
              onClick={() => navigate(`/productos/${producto.id}`)}
              className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-800"
            >
              Detalles
            </button>
            
            {/* Botón Agregar */}
            <button
              onClick={() => agregar(producto)}
              disabled={!producto.disponible}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all duration-200 shadow-md shadow-orange-500/20 hover:shadow-orange-500/40 active:scale-95 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}