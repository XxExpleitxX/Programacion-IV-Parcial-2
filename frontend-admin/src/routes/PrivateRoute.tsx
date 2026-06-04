import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Props {
  children: JSX.Element
  role?: 'ADMIN' | 'CONSULTA' | 'PEDIDOS' | 'STOCK' // roles que pueden acceder a esta ruta (si no se especifica, cualquiera autenticado puede acceder) 
}

export default function PrivateRoute({ children, role }: Props) {
  const { token, role: userRole } = useAuth()

  // 1️⃣ No logueado → login
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // 2️⃣ Tiene rol requerido pero no coincide → redirigir a productos
  if (role && role !== userRole && userRole !== 'ADMIN') {
  return <Navigate to="/productos" replace />
}

  // 3️⃣ Todo OK
  return children
}
