import { useNavigate } from 'react-router-dom'
import { useCarrito } from '../../store/carritoStore'

export default function CarritoPage() {
  const navigate = useNavigate()
  const { items, quitar, setCantidad, limpiar, total } = useCarrito()

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-6xl mb-4">🛒</p>
        <h2 className="text-2xl font-bold text-white mb-2">Tu carrito está vacío</h2>
        <p className="text-gray-400 mb-8">Agregá productos desde el menú</p>
        <button onClick={() => navigate('/')} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
          Ver menú
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">🛒 Tu carrito</h1>
        <button onClick={limpiar} className="text-red-400 hover:text-red-300 text-sm transition-colors">
          Vaciar carrito
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {items.map(({ producto, cantidad }) => (
          <div key={producto.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-900/30 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-2xl">🍽️</span>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium text-sm">{producto.nombre}</p>
              <p className="text-orange-400 text-sm">${producto.precio_base.toFixed(2)} c/u</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCantidad(producto.id, cantidad - 1)}
                className="w-8 h-8 bg-gray-800 rounded-lg text-white hover:bg-gray-700 flex items-center justify-center font-bold">−</button>
              <span className="w-8 text-center text-white font-medium">{cantidad}</span>
              <button onClick={() => setCantidad(producto.id, cantidad + 1)}
                className="w-8 h-8 bg-gray-800 rounded-lg text-white hover:bg-gray-700 flex items-center justify-center font-bold">+</button>
            </div>
            <div className="text-right">
              <p className="text-white font-bold">${(producto.precio_base * cantidad).toFixed(2)}</p>
              <button onClick={() => quitar(producto.id)} className="text-red-400 hover:text-red-300 text-xs mt-1">Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Resumen */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex justify-between text-gray-400 text-sm mb-2">
          <span>Subtotal</span>
          <span>${total().toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-400 text-sm mb-3">
          <span>Envío</span>
          <span>$50.00</span>
        </div>
        <div className="flex justify-between text-white font-bold text-lg border-t border-gray-700 pt-3">
          <span>Total</span>
          <span className="text-orange-400">${(total() + 50).toFixed(2)}</span>
        </div>
      </div>

      <button onClick={() => navigate('/checkout')}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-lg transition-colors">
        Confirmar pedido →
      </button>
    </div>
  )
}
