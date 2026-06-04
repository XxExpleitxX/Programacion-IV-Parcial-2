import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { pedidosApi } from '../api/index'
import { useCarrito } from '../store/carritoStore'
import { useAuth } from '../store/authStore'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, total, limpiar } = useCarrito()
  const { isAuthenticated } = useAuth()
  const [formaPago, setFormaPago] = useState('EFECTIVO')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!isAuthenticated()) {
    navigate('/login')
    return null
  }

  if (items.length === 0) {
    navigate('/')
    return null
  }

  const crearMut = useMutation({
    mutationFn: () => pedidosApi.crear({
      forma_pago_codigo: formaPago,
      notas: notas.trim() || undefined,
      items: items.map(i => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
    }),
    onSuccess: (pedido) => {
      limpiar()
      navigate(`/pedidos/${pedido.id}`)
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Error al crear el pedido'),
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/carrito')} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1">
        ← Volver al carrito
      </button>

      <h1 className="text-2xl font-bold text-white mb-6">Confirmar pedido</h1>

      {/* Resumen de items */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <h2 className="text-white font-semibold mb-3">Tu pedido</h2>
        <div className="space-y-2">
          {items.map(({ producto, cantidad }) => (
            <div key={producto.id} className="flex justify-between text-sm">
              <span className="text-gray-300">{cantidad}x {producto.nombre}</span>
              <span className="text-white">${(producto.precio_base * cantidad).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-700 mt-3 pt-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Subtotal</span><span>${total().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Envío</span><span>$50.00</span>
          </div>
          <div className="flex justify-between font-bold text-white">
            <span>Total</span>
            <span className="text-orange-400">${(total() + 50).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Forma de pago */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <h2 className="text-white font-semibold mb-3">Forma de pago</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { codigo: 'EFECTIVO', label: '💵 Efectivo' },
            { codigo: 'TRANSFERENCIA', label: '🏦 Transferencia' },
            { codigo: 'MERCADOPAGO', label: '💳 MercadoPago' },
          ].map(fp => (
            <button key={fp.codigo} onClick={() => setFormaPago(fp.codigo)}
              className={`py-3 rounded-lg text-sm font-medium border transition-colors ${
                formaPago === fp.codigo
                  ? 'border-orange-500 bg-orange-900/30 text-orange-400'
                  : 'border-gray-700 text-gray-400 hover:border-orange-500/50'
              }`}>
              {fp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notas */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-3">Notas del pedido</h2>
        <textarea
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
          rows={3}
          placeholder="Ej: Sin cebolla, extra queso, puerta 2B..."
          value={notas}
          onChange={e => setNotas(e.target.value)}
        />
      </div>

      {error && <p className="text-red-400 text-sm mb-4 bg-red-900/20 px-4 py-3 rounded-lg">{error}</p>}

      <button
        onClick={() => crearMut.mutate()}
        disabled={crearMut.isPending}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-white font-bold py-4 rounded-xl text-lg transition-colors"
      >
        {crearMut.isPending ? 'Enviando pedido...' : '✓ Hacer pedido'}
      </button>
    </div>
  )
}
