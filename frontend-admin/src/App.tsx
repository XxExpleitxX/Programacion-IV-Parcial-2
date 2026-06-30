
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'

// ── Features ──────────────────────────────────────────────
import LoginPage          from './features/auth/LoginPage'
import DashboardPage      from './features/dashboard/DashboardPage'
import ProductosPage      from './features/productos/ProductosPage'
import ProductoDetallePage from './features/productos/ProductoDetallePage'
import CategoriasPage     from './features/categorias/CategoriasPage'
import IngredientesPage   from './features/ingredientes/IngredientesPage'
import CajeroPedidosPage  from './features/pedidos/CajeroPedidoPage'
import StockPage          from './features/stock/StockPage'

// ── Shared ────────────────────────────────────────────────
import PrivateRoute from './routes/PrivateRoute'

// ── Store (Zustand) ───────────────────────────────────────
import { useAuthStore } from './store/authStore'
import { useWSStore }   from './store/wsStore'

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-brand-700 text-white'
            : 'text-slate-400 hover:text-slate-100 hover:bg-card'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

function Header() {
  // Suscripción por slice — solo re-renderiza si cambia user.rol
  const user    = useAuthStore((s) => s.user)
  const logout  = useAuthStore((s) => s.logout)
  // Badge de conexión WS (RN-06 UI)
  const wsOn    = useWSStore((s) => s.connected)
  const navigate = useNavigate()

  const esAdmin  = user?.rol === 'ADMIN'
  const esCajero = user?.rol === 'PEDIDOS' || user?.rol === 'ADMIN'
  const esStock  = user?.rol === 'STOCK' || user?.rol === 'ADMIN'

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
      <div className="w-full px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">P4</span>
          </div>
          <span className="font-display text-lg text-slate-100">Food Store Admin</span>
        </div>

        {user && (
          <nav className="flex items-center gap-1">
            {esAdmin  && <NavItem to="/dashboard"    label="📊 Dashboard"   />}
            {esAdmin  && <NavItem to="/categorias"   label="Categorías"     />}
            {esAdmin  && <NavItem to="/ingredientes" label="Ingredientes"   />}
            <NavItem to="/productos" label="Productos" />
            {esStock  && <NavItem to="/stock" label="📦 Stock" />}
            {esCajero && <NavItem to="/cajero" label="🧾 Cajero" />}

            {}
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
              wsOn
                ? 'bg-green-900/40 text-green-400'
                : 'bg-slate-800 text-slate-500'
            }`}>
              {wsOn ? '● En vivo' : '○ Sin WS'}
            </span>

            <button
              onClick={handleLogout}
              className="ml-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition"
            >
              Cerrar sesión
            </button>
          </nav>
        )}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 w-full px-6 py-8">
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={
            <PrivateRoute role="ADMIN"><DashboardPage /></PrivateRoute>
          } />
          <Route path="/dashboard" element={
            <PrivateRoute role="ADMIN"><DashboardPage /></PrivateRoute>
          } />
          <Route path="/categorias" element={
            <PrivateRoute role="ADMIN"><CategoriasPage /></PrivateRoute>
          } />
          <Route path="/ingredientes" element={
            <PrivateRoute role="ADMIN"><IngredientesPage /></PrivateRoute>
          } />
          <Route path="/productos" element={
            <PrivateRoute><ProductosPage /></PrivateRoute>
          } />
          <Route path="/productos/:id" element={
            <PrivateRoute><ProductoDetallePage /></PrivateRoute>
          } />
          <Route path="/stock" element={
            <PrivateRoute role="STOCK"><StockPage /></PrivateRoute>
          } />
          <Route path="/cajero" element={
            <PrivateRoute role="PEDIDOS"><CajeroPedidosPage /></PrivateRoute>
          } />
        </Routes>
      </main>
    </div>
  )
}
