/** Contenedor de notificaciones (toasts). Lee del uiStore. */
import { useUI } from '../store/uiStore'

const ESTILOS: Record<string, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-gray-800 border border-gray-700',
}

export default function Toasts() {
  const toasts = useUI(s => s.toasts)
  const removeToast = useUI(s => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map(t => (
        <button
          key={t.id}
          onClick={() => removeToast(t.id)}
          className={`${ESTILOS[t.tipo]} text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-xs text-left`}
        >
          {t.mensaje}
        </button>
      ))}
    </div>
  )
}
