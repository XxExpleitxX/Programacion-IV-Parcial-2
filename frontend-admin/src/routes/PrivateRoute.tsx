
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

type Rol = 'ADMIN' | 'PEDIDOS' | 'STOCK' | 'CLIENT'

interface Props {
  children: JSX.Element
  role?: Rol   // rol mínimo requerido (si no se especifica, solo necesita estar logueado)
}

export default function PrivateRoute({ children, role }: Props) {
  const user = useAuthStore((s) => s.user)

  // No logueado → login
  if (!user) return <Navigate to="/login" replace />

  // Rol requerido: ADMIN siempre pasa, el resto necesita el rol exacto
  if (role && role !== user.rol && user.rol !== 'ADMIN') {
    return <Navigate to="/productos" replace />
  }

  return children
}
