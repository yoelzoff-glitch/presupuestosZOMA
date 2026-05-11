import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-500">
      <div className="relative">
        <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center shadow-inner">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
        <div className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 rounded-full animate-ping" />
      </div>
      <div className="space-y-2 text-center">
        <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Cargando ZOMA</p>
        <div className="flex gap-1 justify-center">
          <div className="h-1 w-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="h-1 w-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="h-1 w-1 bg-blue-600 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  )
}
