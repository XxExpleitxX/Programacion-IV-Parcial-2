import { useEffect, useState } from 'react'

/**
 * useDebounce — devuelve el valor recién después de `delay` ms sin cambios.
 * Evita disparar una query por cada tecla en la búsqueda del catálogo.
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
