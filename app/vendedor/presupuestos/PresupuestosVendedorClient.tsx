'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Search,
  Plus,
  FileText,
  RefreshCw,
  Eye,
  CalendarDays,
  CheckCircle2,
  Clock3,
  XCircle,
  Loader2,
  TrendingUp,
  ShieldCheck
} from 'lucide-react'

type Presupuesto = {
  id: string
  budget_number: number
  budget_code: string
  budget_date: string
  total_amount: number
  status: string
  created_at: string
  client: {
    name: string
    cuit: string
  } | null
}

type Props = {
  presupuestosIniciales: Presupuesto[]
  rol: string
  idUsuario: string
}

export default function PresupuestosVendedorClient({ presupuestosIniciales, rol, idUsuario }: Props) {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>(presupuestosIniciales)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('all')
  const [actualizando, setActualizando] = useState(false)

  async function actualizarPresupuestos() {
    setActualizando(true)
    const esAdmin = rol === 'admin'

    let consulta = supabase
      .from('budgets')
      .select(`
        id, budget_number, budget_code, budget_date, total_amount, status, created_at,
        clients ( name, cuit )
      `)
      .order('budget_number', { ascending: false })

    if (!esAdmin) {
      consulta = consulta.eq('seller_id', idUsuario)
    }

    const { data, error } = await consulta

    if (!error && data) {
      const normalizados = data.map((p: any) => ({
        ...p,
        client: Array.isArray(p.clients) ? p.clients[0] || null : p.clients || null,
      }))
      setPresupuestos(normalizados)
    }
    
    setActualizando(false)
  }

  const presupuestosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return presupuestos.filter((p) => {
      const coincideBusqueda = !q || 
        p.budget_code?.toLowerCase().includes(q) ||
        String(p.budget_number).includes(q) ||
        p.client?.name?.toLowerCase().includes(q)
      
      const coincideEstado = filtroEstado === 'all' || p.status === filtroEstado
      return coincideBusqueda && coincideEstado
    })
  }, [presupuestos, busqueda, filtroEstado])

  const montoTotal = presupuestos
    .filter(p => p.status !== 'cancelled')
    .reduce((acc, p) => acc + Number(p.total_amount || 0), 0)

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-slate-900">Presupuestos</h1>
            {rol === 'admin' && (
              <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck size={10} /> Admin
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 font-medium text-emerald-600 flex items-center gap-1.5">
            <TrendingUp size={14} /> {rol === 'admin' ? 'Facturación potencial global' : 'Mi total vigente'}: ${montoTotal.toLocaleString('es-AR')}
          </p>
        </div>
        <Link
          href="/vendedor/presupuestos/nuevo"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition"
        >
          <Plus size={18} />
          Nuevo Presupuesto
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Número o cliente..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition shadow-sm"
            />
          </div>
          <button
            onClick={actualizarPresupuestos}
            disabled={actualizando}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw size={17} className={actualizando ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {['all', 'issued', 'approved', 'cancelled'].map((val) => (
            <button
              key={val}
              onClick={() => setFiltroEstado(val)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition whitespace-nowrap ${
                filtroEstado === val 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {val === 'all' ? 'Todos' : val === 'issued' ? 'Emitidos' : val === 'approved' ? 'Aprobados' : 'Anulados'}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-4">
        {presupuestosFiltrados.length === 0 ? (
          <div className="bg-white p-12 rounded-[2rem] border border-dashed border-slate-300 text-center">
            <FileText size={40} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold">No se encontraron presupuestos.</p>
          </div>
        ) : (
          presupuestosFiltrados.map((p) => (
            <article 
              key={p.id} 
              className={`bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm hover:shadow-md transition group relative overflow-hidden ${
                p.status === 'cancelled' ? 'opacity-60 grayscale' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-inner">
                    <FileText size={28} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-black text-slate-950 text-lg tracking-tight">
                        {p.budget_code || `000-${p.budget_number}`}
                      </h3>
                      <EtiquetaEstado estado={p.status} />
                    </div>
                    <p className="text-sm font-bold text-slate-600 truncate flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      {p.client?.name || 'Cliente sin nombre'}
                    </p>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto Final</p>
                  <p className="text-2xl font-black text-blue-700 leading-none">
                    ${Number(p.total_amount).toLocaleString('es-AR')}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1.5 rounded-lg">
                    <CalendarDays size={14} />
                    {new Date(p.budget_date).toLocaleDateString()}
                  </div>
                  <div className="sm:hidden font-black text-blue-700 text-base">
                    ${Number(p.total_amount).toLocaleString('es-AR')}
                  </div>
                </div>
                <Link 
                  href={`/vendedor/presupuestos/${p.id}`}
                  className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-xs font-black hover:bg-slate-800 transition shadow-lg shadow-slate-900/10"
                >
                  <Eye size={16} />
                  Detalles
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function EtiquetaEstado({ estado }: { estado: string }) {
  const configs: any = {
    issued: { etiqueta: 'Emitido', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Clock3 },
    approved: { etiqueta: 'Aprobado', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2 },
    cancelled: { etiqueta: 'Anulado', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  }
  const config = configs[estado] || configs.issued
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border ${config.color}`}>
      <config.icon size={10} />
      {config.etiqueta}
    </span>
  )
}
