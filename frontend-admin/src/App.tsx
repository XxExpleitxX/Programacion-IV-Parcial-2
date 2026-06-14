/**
 * App.tsx — enrutamiento principal del panel de administración.
 *
 * Estructura Feature-Sliced Design:
 *   src/
 *   ├── features/
 *   │   ├── auth/          LoginPage
 *   │   ├── dashboard/     DashboardPage (KPIs + recharts)
 *   │   ├── productos/     ProductosPage, ProductoDetallePage
 *   │   ├── categorias/    CategoriasPage
 *   │   ├── ingredientes/  IngredientesPage
 *   │   └── pedidos/       CajeroPedidoPage
 *   ├── shared/
 *   │   ├── api/           axiosInstance + estadisticasApi + demás APIs
 *   │   ├── components/    Modal, etc.
 *   │   ├── hooks/         useOrderStatusWS
 *   │   └── types/         index.ts (todos los tipos)
 *   └── context/           AuthContext (React Context para auth)
 *
 * Flujo de imports: Pages → Shared (api, hooks, types, components)
 * Nunca al revés.
 */

import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'

// ── Features ──────────────────────────────────────────────
import LoginPage        from './features/auth/LoginPage'
import DashboardPage    from './features/dashboard/DashboardPage'
import ProductosPage    from './features/productos/ProductosPage'
import ProductoDetallePage from './features/productos/ProductoDetallePage'
import CategoriasPage   from './features/categorias/CategoriasPage'
import IngredientesPage from './features/ingredientes/IngredientesPage'
import CajeroPedidosPage from './features/pedidos/CajeroPedidoPage'

// ── Shared ────────────────────────────────────────────────
import PrivateRoute from './routes/PrivateRoute'
import { useAuth }  from './context/AuthContext'

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
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const esAdmin  = role === 'ADMIN'
  const esCajero = role === 'PEDIDOS' || role === 'ADMIN'

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">P4</span>
          </div>
          <span className="font-display text-lg text-slate-100">Food Store Admin</span>
        </div>

        {user && (
          <nav className="flex items-center gap-1">
            {esAdmin && <NavItem to="/dashboard"    label="📊 Dashboard"   />}
            {esAdmin && <NavItem to="/categorias"   label="Categorías"     />}
            {esAdmin && <NavItem to="/ingredientes" label="Ingredientes"   />}
            <NavItem to="/productos" label="Productos" />
            {esCajero && <NavItem to="/cajero" label="🧾 Cajero" />}
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Raíz → Dashboard para ADMIN */}
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

          <Route path="/cajero" element={
            <PrivateRoute role="PEDIDOS"><CajeroPedidosPage /></PrivateRoute>
          } />
        </Routes>
      </main>
    </div>
  )
}
