import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { CardPayment } from '@mercadopago/sdk-react'
import { pedidosApi, pagosApi } from '../../shared/api/index'
import { getApiErrorMessage } from '../../shared/api/errors'
import { useCarrito } from '../../store/carritoStore'
import { useAuth } from '../../store/authStore'
import { usePago } from '../../store/pagoStore'
import { useUI } from '../../store/uiStore'
import type { Pedido } from '../../shared/types'

const MP_HABILITADO = Boolean(import.meta.env.VITE_MP_PUBLIC_KEY)

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, total, limpiar } = useCarrito()
  const { isAuthenticated } = useAuth()
  const setUltimoPago = usePago(s => s.setUltimoPago)
  const addToast = useUI(s => s.addToast)
  const [formaPago, setFormaPago] = useState('EFECTIVO')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pedidoMP, setPedidoMP] = useState<Pedido | null>(null)
  const [redirigiendo, setRedirigiendo] = useState(false)

  const pagarConCheckoutPro = async () => {
    if (!pedidoMP) return
    setError(null)
    setRedirigiendo(true)
    const mpTab = window.open('', '_blank')
    try {
      const { init_point } = await pagosApi.crearPreferencia(pedidoMP.id)
      limpiar()
      // Guardamos el pedido_id para que la pestaña de MP sepa que debe cerrarse
      localStorage.setItem('mp_pestaña_pedido', String(pedidoMP.id))
      if (mpTab) mpTab.location.href = init_point
      else window.location.href = init_point
      navigate(`/pedidos/${pedidoMP.id}`)
    } catch (e) {
      if (mpTab) mpTab.close()
      setError(getApiErrorMessage(e, 'No se pudo iniciar el pago con MercadoPago.'))
      setRedirigiendo(false)
    }
  }

  const crearMut = useMutation({
    mutationFn: () => pedidosApi.crear({
      forma_pago_codigo: formaPago,
      notas: notas.trim() || undefined,
      items: items.map(i => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
    }),
    onSuccess: (pedido) => {
      if (formaPago === 'MERCADOPAGO') {
        setPedidoMP(pedido)
      } else {
        limpiar()
        navigate(`/pedidos/${pedido.id}`)
      }
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Error al crear el pedido')),
  })

  if (!isAuthenticated()) {
    navigate('/login')
    return null
  }

  if (items.length === 0 && !pedidoMP) {
    navigate('/')
    return null
  }

  if (pedidoMP) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-1">💳 Pagar con MercadoPago</h1>
        <p className="text-gray-400 text-sm mb-6">
          Pedido #{pedidoMP.id} — Total <span className="text-orange-400 font-semibold">${Number(pedidoMP.total).toFixed(2)}</span>
        </p>

        {error && <p className="text-red-400 text-sm mb-4 bg-red-900/20 px-4 py-3 rounded-lg">{error}</p>}

        <button
          onClick={pagarConCheckoutPro}
          disabled={redirigiendo}
          className="w-full bg-[#009ee3] hover:bg-[#0089c7] disabled:bg-gray-700 text-white font-bold py-4 rounded-xl text-base transition-colors mb-4"
        >
          {redirigiendo ? 'Redirigiendo a MercadoPago…' : '💳 Pagar con MercadoPago'}
        </button>

        {MP_HABILITADO && (
        <>
        <p className="text-gray-500 text-xs text-center mb-3">— o pagá con tarjeta acá —</p>
        <div className="bg-white rounded-xl p-4">
          <CardPayment
            initialization={{ amount: Number(pedidoMP.total) }}
            onSubmit={async (formData) => {
              setError(null)
              try {
                const pago = await pagosApi.crear({
                  pedido_id: pedidoMP.id,
                  token: formData.token,
                  payment_method_id: formData.payment_method_id,
                  installments: formData.installments,
                  payer_email: formData.payer?.email ?? '',
                  issuer_id: formData.issuer_id != null ? String(formData.issuer_id) : undefined,
                })
                setUltimoPago({
                  pedido_id: pedidoMP.id,
                  mp_status: pago.mp_status,
                  mp_status_detail: pago.mp_status_detail,
                })
                if (pago.mp_status === 'approved') {
                  addToast('¡Pago aprobado! 🎉', 'success')
                  limpiar()
                  navigate(`/pedidos/${pedidoMP.id}`)
                } else {
                  setError(`Pago ${pago.mp_status}${pago.mp_status_detail ? `: ${pago.mp_status_detail}` : ''}. Probá con otra tarjeta.`)
                }
              } catch (e) {
                setError(getApiErrorMessage(e, 'Error procesando el pago.'))
              }
            }}
            onError={() => setError('Error en el formulario de pago. Revisá los datos.')}
          />
        </div>
        </>
        )}

        <button
          onClick={() => { limpiar(); navigate(`/pedidos/${pedidoMP.id}`) }}
          className="block text-gray-500 hover:text-gray-300 text-sm mt-4"
        >
          Pagar más tarde / ver mi pedido →
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/carrito')} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1">
        ← Volver al carrito
      </button>

      <h1 className="text-2xl font-bold text-white mb-6">Confirmar pedido</h1>

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
        {formaPago === 'MERCADOPAGO' && (
          <p className="text-gray-500 text-xs mt-3">
            Al confirmar vas a pagar con tarjeta de forma segura (los datos los procesa MercadoPago).
          </p>
        )}
      </div>

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
        {crearMut.isPending
          ? 'Enviando pedido...'
          : formaPago === 'MERCADOPAGO' ? '💳 Continuar al pago' : '✓ Hacer pedido'}
      </button>
    </div>
  )
}