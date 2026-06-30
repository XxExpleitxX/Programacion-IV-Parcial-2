interface CategoriaNodo {
  id: number
  subcategorias?: CategoriaNodo[]
}

// Helper — dada una categoría y el árbol completo, devuelve todos los IDs de sus descendientes
export function getDescendantIds(cat: CategoriaNodo): number[] {
  const subs = cat.subcategorias ?? []
  return [cat.id, ...subs.flatMap(getDescendantIds)]
}

// Helper — al marcar una categoría padre, marca todas sus hijas
// Al marcar una hija, NO marca el padre
export function toggleCategoriaConCascada(
  id: number,
  arbol: CategoriaNodo[],
  seleccionados: number[],
): number[] {
  // Buscar el nodo en el árbol
  const encontrar = (cats: CategoriaNodo[]): CategoriaNodo | null => {
    for (const c of cats) {
      if (c.id === id) return c
      const found = encontrar(c.subcategorias ?? [])
      if (found) return found
    }
    return null
  }

  const nodo = encontrar(arbol)
  const estaSeleccionado = seleccionados.includes(id)

  if (estaSeleccionado) {
    // Desmarcar — sacar el nodo y todos sus descendientes
    const idsARemover = new Set(nodo ? getDescendantIds(nodo) : [id])
    return seleccionados.filter(i => !idsARemover.has(i))
  } else {
    // Marcar — agregar el nodo y todos sus descendientes
    const idsAAgregar = nodo ? getDescendantIds(nodo) : [id]
    return [...new Set([...seleccionados, ...idsAAgregar])]
  }
}