import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-border transition-colors"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
