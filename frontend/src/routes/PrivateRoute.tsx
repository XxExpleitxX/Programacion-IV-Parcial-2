import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Props {
  children: JSX.Element
  role?: 'ADMIN' | 'CONSULTA'
}

export default function PrivateRoute({ children, role }: Props) {
  const { token, role: userRole } = useAuth()

  // 1️⃣ No logueado → login
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // 2️⃣ Tiene rol requerido pero no coincide → redirigir a productos
  if (role && role !== userRole) {
    return <Navigate to="/productos" replace />
  }

  // 3️⃣ Todo OK
  return children
}
