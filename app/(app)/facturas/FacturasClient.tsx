'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Receipt, Search, RefreshCw, Eye, User, DollarSign,
  CheckCircle2, XCircle, Loader2, Clock3, FileText,
  Printer, ShieldCheck, MoreVertical, Trash2, Send
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Factura = {
  id: string
  invoice_number: number
  invoice_date: string
  status: 'draft' | 'emitted' | 'cancelled'
  total_amount: number
  afip_cae?: string | null
  afip_comprobante_numero?: number | null
  afip_comprobante_tipo?: number | null
  created_at: string
  client: { name: string; cuit: string } | null
  budget_id?: string | null
  budget?: { budget_code: string; budget_number: number } | null
}

type Props = {
  facturasIniciales: Factura[]
  idEmpresa: string
}

export default function FacturasClient({ facturasIniciales, idEmpresa }: Props) {
  const [facturas, setFacturas] = useState<Factura[]>(facturasIniciales)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'all' | 'draft' | 'emitted'>('all')
  const [filtroTiempo, setFiltroTiempo] = useState<number | 'all'>(30) // 30 días por defecto
  const [cargando, setCargando] = useState(false)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)

  async function cargarFacturas(dias: number | 'all' = filtroTiempo) {
    setCargando(true)
    
    let query = supabase
      .from('invoices')
      .select(`
        *,
        client:clients ( name, cuit ),
        budget:budgets ( budget_code, budget_number )
      `)
      .eq('company_id', idEmpresa)
      .order('created_at', { ascending: false })

    if (dias !== 'all') {
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() - (dias as number))
      query = query.gte('created_at', fechaLimite.toISOString())
    }

    const { data, error } = await query

    if (error) toast.error('Error al cargar facturas')
    else setFacturas(data || [])
    setCargando(false)
  }

  const cambiarFiltroTiempo = (nuevoRango: number | 'all') => {
    setFiltroTiempo(nuevoRango)
    cargarFacturas(nuevoRango)
  }

  async function legalizarFactura(id: string) {
    setProcesandoId(id)
    try {
      // Nota: Aquí llamaremos a la API de AFIP que ya tenemos, 
      // pero necesitaremos ajustarla para que acepte un invoice_id o budget_id.
      // Por ahora, simulamos el éxito o llamamos a la ruta actual si tiene budget_id.
      const factura = facturas.find(f => f.id === id)
      if (!factura?.budget?.budget_number) {
        throw new Error('Esta factura no está asociada a un presupuesto válido para AFIP.')
      }

      const response = await fetch('/api/afip/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_id: factura.budget_id })
      })

      const data = await response.json()
      if (data.success) {
        toast.success('¡Factura legalizada con éxito!')
        cargarFacturas()
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    } finally {
      setProcesandoId(null)
    }
  }

  const facturasFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return facturas.filter(f => {
      const coincideBusqueda = !q || f.client?.name?.toLowerCase().includes(q) || String(f.afip_comprobante_numero).includes(q)
      const coincideEstado = filtroEstado === 'all' || f.status === filtroEstado
      return coincideBusqueda && coincideEstado
    })
  }, [facturas, busqueda, filtroEstado])

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-200">
              <Receipt size={14} /> Facturación
            </div>
            <h1 className="text-3xl font-black tracking-tight">Gestión de Facturas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Administra tus comprobantes, borradores y autorizaciones de ARCA.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <TarjetaEstado titulo="Total Facturado" valor={`$${facturas.filter(f => f.status === 'emitted').reduce((acc, f) => acc + f.total_amount, 0).toLocaleString('es-AR')}`} icon={DollarSign} color="indigo" />
        <TarjetaEstado titulo="Borradores" valor={facturas.filter(f => f.status === 'draft').length} icon={Clock3} color="amber" />
        <TarjetaEstado titulo="Legalizadas" valor={facturas.filter(f => f.status === 'emitted').length} icon={ShieldCheck} color="emerald" />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="space-y-4 border-b border-slate-200 p-5 bg-slate-50/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row w-full lg:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por cliente o número..."
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-2">
              <button 
                onClick={() => cargarFacturas()} 
                className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition"
                title="Actualizar lista"
              >
                <RefreshCw size={17} className={cargando ? 'animate-spin' : ''} />
              </button>
            </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
                {[
                  { label: '7D', value: 7 },
                  { label: '14D', value: 14 },
                  { label: '30D', value: 30 },
                  { label: '60D', value: 60 },
                  { label: 'Todo', value: 'all' }
                ].map((r) => (
                  <button
                    key={r.label}
                    onClick={() => cambiarFiltroTiempo(r.value as any)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition ${filtroTiempo === r.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block" />
              <button onClick={() => setFiltroEstado('all')} className={`px-4 py-2 rounded-full text-xs font-black transition ${filtroEstado === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Todas</button>
              <button onClick={() => setFiltroEstado('draft')} className={`px-4 py-2 rounded-full text-xs font-black transition ${filtroEstado === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>Borradores</button>
              <button onClick={() => setFiltroEstado('emitted')} className={`px-4 py-2 rounded-full text-xs font-black transition ${filtroEstado === 'emitted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>Legalizadas</button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Nro. Factura</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Presupuesto</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facturasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400 font-bold italic">No se encontraron facturas</td>
                </tr>
              ) : facturasFiltradas.map(f => (
                <tr key={f.id} className="hover:bg-indigo-50/30 transition group">
                  <td className="px-6 py-4 text-sm font-black text-slate-900">
                    {f.status === 'emitted' ? (
                      <div className="flex flex-col">
                        <span>{String(f.afip_comprobante_numero).padStart(8, '0')}</span>
                        <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Pto. Venta 00002</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Sin numerar (Borrador)</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-700">{f.client?.name}</p>
                    <p className="text-[10px] font-bold text-slate-400">{f.client?.cuit}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                      <FileText size={10} /> {f.budget?.budget_code || `#${f.budget?.budget_number}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900">
                    ${f.total_amount.toLocaleString('es-AR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <EtiquetaEstado estado={f.status} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {f.status === 'draft' && (
                        <button
                          onClick={() => legalizarFactura(f.id)}
                          disabled={!!procesandoId}
                          className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                          title="Legalizar en AFIP"
                        >
                          {procesandoId === f.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                      )}
                      {f.status === 'emitted' && (
                        <Link
                          href={`/facturas/ver/${f.budget_id}`}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                          title="Ver / Imprimir"
                        >
                          <Printer size={18} />
                        </Link>
                      )}
                      <button className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function TarjetaEstado({ titulo, valor, icon: Icon, color }: { titulo: string; valor: number | string; icon: LucideIcon; color: 'indigo' | 'amber' | 'emerald' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  }
  return (
    <div className={`bg-white p-5 rounded-3xl border ${colors[color]} shadow-sm flex items-center gap-4`}>
      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${colors[color].replace('bg-', 'bg-opacity-50 bg-')}`}><Icon size={22} /></div>
      <div className="min-w-0"><p className="text-xs font-bold text-slate-400 truncate uppercase tracking-widest">{titulo}</p><h2 className="text-xl font-black text-slate-950 truncate">{valor}</h2></div>
    </div>
  )
}

function EtiquetaEstado({ estado }: { estado: 'draft' | 'emitted' | 'cancelled' }) {
  const configs = {
    draft: { etiqueta: 'No emitida', icon: Clock3, className: 'bg-amber-50 text-amber-600 border-amber-100' },
    emitted: { etiqueta: 'Emitida', icon: ShieldCheck, className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    cancelled: { etiqueta: 'Anulada', icon: XCircle, className: 'bg-red-50 text-red-600 border-red-100' },
  }
  const config = configs[estado]
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${config.className}`}>
      <config.icon size={12} /> {config.etiqueta}
    </span>
  )
}
