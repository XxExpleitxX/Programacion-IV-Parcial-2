import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productosApi, categoriasApi } from '../api/index'
import ProductoCard from '../components/ProductoCard'
import type { Categoria } from '../types/index'

function aplanarCategorias(cats: Categoria[], nivel = 0): { cat: Categoria; nivel: number }[] {
  return cats.flatMap(c => [{ cat: c, nivel }, ...aplanarCategorias(c.subcategorias ?? [], nivel + 1)])
}

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [categoriaId, setCategoriaId] = useState<number | null>(null)
  const [precioMax, setPrecioMax] = useState<number | null>(null)

  // Query de productos
  const { data: productos = [], isLoading, isFetching } = useQuery({
    queryKey: ['store-productos', search, categoriaId, precioMax],
    queryFn: () => productosApi.getAll({
      nombre: search || undefined,
      categoria_id: categoriaId ?? undefined,
      precio_max: precioMax ?? undefined,
      disponible: true,
    }),
  })

  // Query de categorías
  const { data: arbolCats = [] } = useQuery({
    queryKey: ['store-categorias'],
    queryFn: () => categoriasApi.getArbol(),
  })

  const categorias = aplanarCategorias(arbolCats)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
      
      {/* Header del Menú */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Nuestro <span className="text-orange-500">Menú</span> 🍕
          </h1>
          <p className="text-gray-400 mt-2 text-lg">Descubre sabores increíbles hoy</p>
        </div>
        
        {/* Contador de resultados */}
        {!isLoading && (
           <span className="text-gray-500 text-sm font-medium bg-gray-800 px-3 py-1 rounded-full">
             {productos.length} productos encontrados
           </span>
        )}
      </div>

      {/* BARRA DE FILTROS MEJORADA */}
      <div className="space-y-4 mb-10 bg-gray-800/50 p-6 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
        
        {/* Fila 1: Búsqueda y Precio */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Buscador */}
          <div className="relative flex-grow">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              className="w-full bg-gray-900 border border-gray-600 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
              placeholder="Buscar hamburguesas, pizzas, bebidas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filtro de Precio (Dropdown discreto) */}
          <select
            className="bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
            value={precioMax ?? ''}
            onChange={e => setPrecioMax(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">💰 Cualquier precio</option>
            <option value="5000">Hasta $5.000</option>
            <option value="10000">Hasta $10.000</option>
            <option value="20000">Hasta $20.000</option>
          </select>
        </div>

        {/* Fila 2: Categorías como CHIPS (Pills) */}
        <div className="flex flex-wrap gap-2 pt-2">
           {/* Chip "Todos" */}
           <button 
             onClick={() => setCategoriaId(null)}
             className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
               categoriaId === null 
                 ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/30' 
                 : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600 hover:text-white'
             }`}
           >
             🍽️ Todos
           </button>

           {/* Chips de Categorías */}
           {categorias.map(({ cat, nivel }) => (
             <button 
               key={cat.id}
               onClick={() => setCategoriaId(categoriaId === cat.id ? null : cat.id)}
               className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border whitespace-nowrap ${
                 categoriaId === cat.id
                   ? 'bg-white text-gray-900 border-white font-bold' // Activo: fondo blanco para contraste
                   : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:border-gray-500'
               }`}
             >
               {/* Agrega un pequeño margen a la izquierda si es subcategoría */}
               {nivel > 0 && <span className="mr-1 opacity-50">↳</span>}
               {cat.nombre}
             </button>
           ))}
        </div>
      </div>

      {/* GRID DE PRODUCTOS CON SKELETONS */}
      {isLoading ? (
        // Skeletons de carga (se ve profesional)
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="bg-gray-800 rounded-2xl overflow-hidden animate-pulse">
              <div className="h-48 bg-gray-700"></div>
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-700 rounded w-full"></div>
                <div className="flex justify-between pt-2">
                   <div className="h-6 bg-gray-700 rounded w-1/4"></div>
                   <div className="h-8 bg-gray-700 rounded w-1/3"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Estado Vacío */}
          {productos.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-6xl mb-4 grayscale opacity-50">🍔</div>
              <h3 className="text-2xl font-bold text-white mb-2">¡Ups! No hay hambre aquí</h3>
              <p className="text-gray-400">No encontramos productos con esos filtros. Intenta cambiar la búsqueda.</p>
              <button 
                onClick={() => {setSearch(''); setCategoriaId(null); setPrecioMax(null)}}
                className="mt-6 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full text-sm font-medium transition-colors"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            /* Resultados Reales */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {productos.map(p => (
                <ProductoCard key={p.id} producto={p} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}