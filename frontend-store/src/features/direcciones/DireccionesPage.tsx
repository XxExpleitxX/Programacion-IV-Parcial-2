import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { direccionesApi } from '../../shared/api/index'
import { getApiErrorMessage } from '../../shared/api/errors'
import { useAuth } from '../../store/authStore'
import { useUI } from '../../store/uiStore'
import type { Direccion, DireccionInput } from '../../shared/types'

const VACIA: DireccionInput = {
  alias: '', linea1: '', linea2: '', ciudad: '', provincia: '', codigo_postal: '', es_principal: false,
}

export default function DireccionesPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const addToast = useUI(s => s.addToast)

  const [editId, setEditId] = useState<number | null>(null)   // null = nueva
  const [form, setForm] = useState<DireccionInput>(VACIA)
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (!isAuthenticated()) navigate('/login') }, [isAuthenticated, navigate])

  const { data: direcciones = [], isLoading } = useQuery({
    queryKey: ['direcciones'],
    queryFn: () => direccionesApi.getAll(),
    enabled: isAuthenticated(),
  })

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['direcciones'] })

  const guardarMut = useMutation({
    mutationFn: () => editId
      ? direccionesApi.actualizar(editId, form)
      : direccionesApi.crear(form),
    onSuccess: () => {
      invalidar(); cerrarForm()
      addToast(editId ? 'Dirección actualizada' : 'Dirección agregada', 'success')
    },
    onError: (e) => setError(getApiErrorMessage(e, 'No se pudo guardar la dirección')),
  })

  const principalMut = useMutation({
    mutationFn: (id: number) => direccionesApi.marcarPrincipal(id),
    onSuccess: () => { invalidar(); addToast('Dirección principal actualizada', 'info') },
  })

  const eliminarMut = useMutation({
    mutationFn: (id: number) => direccionesApi.eliminar(id),
    onSuccess: () => { invalidar(); addToast('Dirección eliminada', 'info') },
  })

  const abrirNueva = () => { setEditId(null); setForm(VACIA); setError(null); setAbierto(true) }
  const abrirEditar = (d: Direccion) => {
    setEditId(d.id)
    setForm({
      alias: d.alias ?? '', linea1: d.linea1, linea2: d.linea2 ?? '',
      ciudad: d.ciudad, provincia: d.provincia ?? '', codigo_postal: d.codigo_postal ?? '',
      es_principal: d.es_principal,
    })
    setError(null); setAbierto(true)
  }
  const cerrarForm = () => { setAbierto(false); setEditId(null); setForm(VACIA) }

  const set = (k: keyof DireccionInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  if (!isAuthenticated()) return null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">📍 Mis direcciones</h1>
        <button onClick={abrirNueva}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          + Nueva dirección
        </button>
      </div>

      {isLoading && <p className="text-gray-400 text-center py-12">Cargando direcciones...</p>}

      {!isLoading && direcciones.length === 0 && !abierto && (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">📭</p>
          <p className="text-gray-400">Todavía no tenés direcciones guardadas</p>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-3 mb-6">
        {direcciones.map(d => (
          <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{d.alias || 'Dirección'}</span>
                {d.es_principal && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/40 text-orange-300">Principal</span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-1">
                {d.linea1}{d.linea2 ? `, ${d.linea2}` : ''} — {d.ciudad}{d.provincia ? `, ${d.provincia}` : ''}
                {d.codigo_postal ? ` (${d.codigo_postal})` : ''}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0 text-xs">
              {!d.es_principal && (
                <button onClick={() => principalMut.mutate(d.id)}
                  className="text-orange-400 hover:text-orange-300">Hacer principal</button>
              )}
              <button onClick={() => abrirEditar(d)} className="text-gray-300 hover:text-white">Editar</button>
              <button onClick={() => { if (confirm('¿Eliminar esta dirección?')) eliminarMut.mutate(d.id) }}
                className="text-red-400 hover:text-red-300">Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Formulario crear/editar */}
      {abierto && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">{editId ? 'Editar dirección' : 'Nueva dirección'}</h2>
          <form
            onSubmit={(e) => { e.preventDefault(); setError(null); guardarMut.mutate() }}
            className="grid grid-cols-2 gap-3"
          >
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500 col-span-2" placeholder="Alias (ej: Casa, Trabajo)" value={form.alias} onChange={set('alias')} />
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500 col-span-2" placeholder="Calle y número *" value={form.linea1} onChange={set('linea1')} required />
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500 col-span-2" placeholder="Piso / depto / referencia" value={form.linea2} onChange={set('linea2')} />
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500" placeholder="Ciudad *" value={form.ciudad} onChange={set('ciudad')} required />
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500" placeholder="Provincia" value={form.provincia} onChange={set('provincia')} />
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500" placeholder="Código postal" value={form.codigo_postal} onChange={set('codigo_postal')} />
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.es_principal}
                onChange={e => setForm(f => ({ ...f, es_principal: e.target.checked }))}
                className="w-4 h-4 accent-orange-500" />
              Marcar como principal
            </label>
            {error && <p className="col-span-2 text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <div className="col-span-2 flex justify-end gap-3 mt-1">
              <button type="button" onClick={cerrarForm} className="text-gray-400 hover:text-white text-sm px-4 py-2">Cancelar</button>
              <button type="submit" disabled={guardarMut.isPending}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-white font-semibold px-5 py-2 rounded-xl text-sm">
                {guardarMut.isPending ? 'Guardando...' : editId ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
