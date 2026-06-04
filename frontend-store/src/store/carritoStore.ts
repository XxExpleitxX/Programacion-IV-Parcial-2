/**
 * Carrito con Zustand + persistencia en localStorage.
 * El middleware `persist` guarda automáticamente el estado
 * y lo restaura al recargar la página.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Producto, ItemCarrito } from '../types/index'

interface CarritoState {
  items: ItemCarrito[]
  agregar: (producto: Producto) => void
  quitar: (productoId: number) => void
  setCantidad: (productoId: number, cantidad: number) => void
  limpiar: () => void
  total: () => number
  cantidadTotal: () => number
}

export const useCarrito = create<CarritoState>()(
  persist(
    (set, get) => ({
      items: [],

      agregar: (producto) => set(state => {
        const existe = state.items.find(i => i.producto.id === producto.id)
        if (existe) {
          return {
            items: state.items.map(i =>
              i.producto.id === producto.id
                ? { ...i, cantidad: i.cantidad + 1 }
                : i
            )
          }
        }
        return { items: [...state.items, { producto, cantidad: 1 }] }
      }),

      quitar: (productoId) => set(state => ({
        items: state.items.filter(i => i.producto.id !== productoId)
      })),

      setCantidad: (productoId, cantidad) => set(state => {
        if (cantidad <= 0) {
          return { items: state.items.filter(i => i.producto.id !== productoId) }
        }
        return {
          items: state.items.map(i =>
            i.producto.id === productoId ? { ...i, cantidad } : i
          )
        }
      }),

      limpiar: () => set({ items: [] }),

      total: () => get().items.reduce(
        (sum, i) => sum + i.producto.precio_base * i.cantidad, 0
      ),

      cantidadTotal: () => get().items.reduce(
        (sum, i) => sum + i.cantidad, 0
      ),
    }),
    {
      name: 'carrito-store', // clave en localStorage
    }
  )
)
