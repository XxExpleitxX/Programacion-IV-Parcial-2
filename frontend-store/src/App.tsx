import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { useCarrito } from './store/carritoStore'
import { useAuth } from './store/authStore'
import { authApi } from './shared/api/index'
import HomePage from './features/catalogo/HomePage'
import ProductoDetallePage from './features/catalogo/ProductoDetallePage'
import CarritoPage from './features/carrito/CarritoPage'
import CheckoutPage from './features/checkout/CheckoutPage'
import MisPedidosPage from './features/pedidos/MisPedidosPage'
import SeguimientoPedidoPage from './features/pedidos/SeguimientoPedidoPage'
import DireccionesPage from './features/direcciones/DireccionesPage'
import LoginPage from './features/auth/LoginPage'
import Toasts from './shared/components/Toasts'

function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const cantidadTotal = useCarrito(s => s.cantidadTotal)
  const { user, logout, isAuthenticated } = useAuth()

  
  if (location.pathname === '/login') return null

  const handleLogout = async () => {
    await authApi.logout(user?.refresh_token)
    logout()
    navigate('/')
  }

  return (
    <header className="bg-[#111] border-b border-gray-900 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <span className="text-lg">🍕</span>
          </div>
          <span className="text-white font-bold text-lg">Food Store</span>
        </Link>

        {/* Nav central */}
        <nav className="hidden md:flex items-center gap-1">
          <Link to="/"
            className="text-gray-400 hover:text-white hover:bg-white/5 px-4 py-2 rounded-xl text-sm font-medium transition-all">
            🍽️ Carta
          </Link>
          {isAuthenticated() && (
            <Link to="/mis-pedidos"
              className="text-gray-400 hover:text-white hover:bg-white/5 px-4 py-2 rounded-xl text-sm font-medium transition-all">
              📦 Mis pedidos
            </Link>
          )}
          {isAuthenticated() && (
            <Link to="/direcciones"
              className="text-gray-400 hover:text-white hover:bg-white/5 px-4 py-2 rounded-xl text-sm font-medium transition-all">
              📍 Direcciones
            </Link>
          )}
        </nav>

        {/* Acciones derecha */}
        <div className="flex items-center gap-3">

          {/* Carrito */}
          <Link to="/carrito"
            className="relative flex items-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-orange-500/50 px-4 py-2 rounded-xl transition-all">
            <span className="text-lg">🛒</span>
            <span className="text-white text-sm font-medium hidden sm:block">Carrito</span>
            {cantidadTotal() > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                {cantidadTotal()}
              </span>
            )}
          </Link>

          {/* Auth */}
          {isAuthenticated() ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 bg-gray-900 border border-gray-800 px-3 py-2 rounded-xl">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{user?.username?.[0]?.toUpperCase()}</span>
                </div>
                <span className="text-gray-300 text-sm">{user?.username}</span>
              </div>
              <button onClick={handleLogout}
                className="text-gray-600 hover:text-red-400 text-sm transition-colors px-2 py-2">
                Salir
              </button>
            </div>
          ) : (
            <Link to="/login"
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-md shadow-orange-500/20">
              Ingresar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#111]">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/productos/:id" element={<ProductoDetallePage />} />
        <Route path="/carrito" element={<CarritoPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/mis-pedidos" element={<MisPedidosPage />} />
        <Route path="/direcciones" element={<DireccionesPage />} />
        <Route path="/pedidos/:id" element={<SeguimientoPedidoPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
      <Toasts />
    </div>
  )
}