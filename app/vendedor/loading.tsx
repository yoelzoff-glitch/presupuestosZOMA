import { Loader2, TrendingUp } from 'lucide-react'

export default function VendedorLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in duration-500">
      <div className="relative">
        <div className="h-20 w-20 rounded-[2rem] bg-slate-900 flex items-center justify-center shadow-2xl">
          <TrendingUp className="h-10 w-10 text-blue-400 animate-pulse" />
        </div>
        <Loader2 className="absolute -bottom-2 -right-2 h-8 w-8 text-blue-500 animate-spin bg-white rounded-full p-1 shadow-lg" />
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-lg font-black text-slate-900 tracking-tight">Portal de Ventas</h3>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Sincronizando datos...</p>
      </div>
      
      {/* Esqueleto de tarjetas sugerido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl px-4 opacity-50">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-white rounded-[1.5rem] border border-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
