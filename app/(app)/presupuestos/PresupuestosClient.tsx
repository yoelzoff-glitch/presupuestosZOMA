'use client'
import FilterButton from '@/app/components/FilterButton'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { 
  FileText, Plus, Search, RefreshCw, Eye, User, DollarSign, 
  CheckCircle2, XCircle, Loader2, Clock3, Lock, ShieldCheck, Printer
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type EstadoPresupuesto = 'all' | 'issued' | 'approved' | 'draft' | 'cancelled'

type Presupuesto = {
  id: string
  budget_number: number
  budget_code: string
  budget_date: string
  total_amount: number
  status: string
  payment_status: 'unpaid' | 'partial' | 'paid'
  paid_amount: number
  created_at: string
  viewed_at?: string | null
  seller_id?: string
  seller?: { full_name: string } | null
  client: { name: string; cuit: string } | null
  afip_cae?: string | null
  invoices?: { id: string }[]
}

type PerfilVendedor = { id: string; full_name: string }

const filtrosEstado: { etiqueta: string; valor: EstadoPresupuesto }[] = [
  { etiqueta: 'Todos', valor: 'all' },
  { etiqueta: 'Emitidos', valor: 'issued' },
  { etiqueta: 'Aprobados', valor: 'approved' },
  { etiqueta: 'Cancelados', valor: 'cancelled' },
]

type Props = {
  presupuestosIniciales: Presupuesto[]
  vendedoresIniciales: PerfilVendedor[]
  idEmpresa: string
  planType: string
}

export default function PresupuestosClient({
  presupuestosIniciales,
  vendedoresIniciales,
  idEmpresa,
  planType,
}: Props) {
  const router = useRouter()
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>(presupuestosIniciales)
  const [vendedores] = useState<PerfilVendedor[]>(vendedoresIniciales)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoPresupuesto>('all')
  const [filtroVendedor, setFiltroVendedor] = useState<string>('all')
  const [cargando, setCargando] = useState(false)
  const [filtroDias, setFiltroDias] = useState('30')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  async function cargarPresupuestos() {
    setCargando(true)

    let consulta = supabase
      .from('budgets')
      .select(`id, budget_number, budget_code, budget_date, total_amount, status, payment_status, paid_amount, created_at, viewed_at, seller_id, afip_cae, clients ( name, cuit ), invoices(id), seller:users_profiles!budgets_seller_id_fkey ( full_name )`)
      .eq('company_id', idEmpresa)
      .order('budget_number', { ascending: false })

    if (filtroDias !== 'all') {
      const limiteFecha = new Date()
      limiteFecha.setDate(limiteFecha.getDate() - parseInt(filtroDias))
      consulta = consulta.gte('created_at', limiteFecha.toISOString())
    }

    const { data, error } = await consulta

    if (error) toast.error(error.message)
    else {
      const normalizados = data.map((p: any) => ({
        ...p,
        client: Array.isArray(p.clients) ? p.clients[0] || null : p.clients || null,
        seller: Array.isArray(p.seller) ? p.seller[0] || null : p.seller || null
      }))
      console.log('Presupuestos cargados:', normalizados.map(p => ({ id: p.id, code: p.budget_code, invoices: p.invoices })))
      setPresupuestos(normalizados)
    }
    setCargando(false)
  }

  const presupuestosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return presupuestos.filter((p: any) => {
      const coincideBusqueda = !q || p.budget_code?.toLowerCase().includes(q) || String(p.budget_number).includes(q) || p.client?.name?.toLowerCase().includes(q)
      const coincideEstado = filtroEstado === 'all' || p.status === filtroEstado
      const coincideVendedor = filtroVendedor === 'all' || p.seller_id === filtroVendedor
      return coincideBusqueda && coincideEstado && coincideVendedor
    })
  }, [presupuestos, busqueda, filtroEstado, filtroVendedor])

  useEffect(() => {
    setCurrentPage(1)
  }, [busqueda, filtroEstado, filtroVendedor, filtroDias])

  const totalPages = Math.ceil(presupuestosFiltrados.length / itemsPerPage)
  const presupuestosPaginados = presupuestosFiltrados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const montoTotal = presupuestos.filter(p => p.status !== 'cancelled').reduce((acc, p) => acc + Number(p.total_amount || 0), 0)

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200"><FileText size={14} /> Presupuestos</div>
            <h1 className="text-3xl font-black tracking-tight">Ventas y Presupuestos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Control total de las cotizaciones emitidas por toda la fuerza de ventas.</p>
          </div>
          <Link href="/presupuestos/nuevo" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500 active:scale-95"><Plus size={18} /> Nuevo presupuesto</Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaEstado titulo="Total" valor={presupuestos.length} icon={FileText} cargando={cargando} />
        <TarjetaEstado titulo="Emitidos" valor={presupuestos.filter(p => p.status === 'issued').length} icon={Clock3} cargando={cargando} />
        <TarjetaEstado titulo="Aprobados" valor={presupuestos.filter(p => p.status === 'approved').length} icon={CheckCircle2} cargando={cargando} />
        <TarjetaEstado titulo="Monto Vigente" valor={`$${montoTotal.toLocaleString('es-AR')}`} icon={DollarSign} cargando={cargando} />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="space-y-4 border-b border-slate-200 p-5 bg-slate-50/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-xl font-black text-slate-950">Listado General</h2><p className="text-sm text-slate-500">Filtrá por número, cliente o vendedor.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-500 sm:w-64" /></div>
               <div className="relative group">
                <select 
                  value={filtroVendedor} 
                  disabled={planType === 'base'}
                  onChange={(e) => setFiltroVendedor(e.target.value)} 
                  className={`rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 ${
                    planType === 'base' ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="all">Todos los vendedores</option>
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.full_name}</option>)}
                </select>

                {planType === 'base' && (
                  <div className="absolute -top-3 -right-3 flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-xl ring-2 ring-white animate-bounce">
                    <Lock size={10} /> PRO
                  </div>
                )}
              </div>
              <button onClick={cargarPresupuestos} className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition"><RefreshCw size={17} className={cargando ? 'animate-spin' : ''} /></button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {filtrosEstado.map(f => <button key={f.valor} onClick={() => setFiltroEstado(f.valor)} className={`px-4 py-2 rounded-full text-xs font-black transition ${filtroEstado === f.valor ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{f.etiqueta}</button>)}

            <div className="h-6 w-px bg-slate-200 mx-2" />

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
               <FilterButton active={filtroDias === '7'} onClick={() => setFiltroDias('7')}>7D</FilterButton>
               <FilterButton active={filtroDias === '30'} onClick={() => setFiltroDias('30')}>30D</FilterButton>
               <FilterButton active={filtroDias === '90'} onClick={() => setFiltroDias('90')}>90D</FilterButton>
               <FilterButton active={filtroDias === 'all'} onClick={() => setFiltroDias('all')}>Todo</FilterButton>
            </div>
          </div>
        </div>

        {cargando ? <EstadoCargando /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-4">Presupuesto</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Vendedor</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {presupuestosPaginados.map(p => (
                  <tr key={p.id} className="hover:bg-blue-50/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-slate-900">{p.budget_code || `000-${p.budget_number}`}</p>
                        {p.viewed_at && <span title={`Visto el ${new Date(p.viewed_at).toLocaleDateString('es-AR')}`}><Eye size={14} className="text-emerald-500" /></span>}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">{new Date(p.budget_date).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{p.client?.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><User size={14} /></div>
                        <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]">{p.seller?.full_name || 'Sistema'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-blue-700">${p.total_amount.toLocaleString('es-AR')}</td>
                    <td className="px-6 py-4"><EtiquetaEstado estado={p.status} tieneCAE={!!p.afip_cae} /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.status === 'issued' && !p.afip_cae && (
                          <Link 
                            href={`/presupuestos/${p.id}/edit`}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                          >
                            Editar
                          </Link>
                        )}
                        <Link href={`/presupuestos/${p.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"><Eye size={14} /> Ver</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 bg-white p-5">
                <span className="text-xs font-bold text-slate-500">
                  Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, presupuestosFiltrados.length)} de {presupuestosFiltrados.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="flex items-center justify-center rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function TarjetaEstado({ titulo, valor, icon: Icon, cargando }: { titulo: string; valor: number | string; icon: LucideIcon; cargando: boolean }) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Icon size={22} /></div>
      <div className="min-w-0"><p className="text-xs font-bold text-slate-400 truncate">{titulo}</p><h2 className="text-xl font-black text-slate-950 truncate">{cargando ? '...' : valor}</h2></div>
    </div>
  )
}

function EtiquetaEstado({ estado, tieneCAE }: { estado: string; tieneCAE?: boolean }) {
  const configs: any = {
    cancelled: { etiqueta: 'Cancelado', icon: XCircle, className: 'bg-red-50 text-red-600' },
    approved: { etiqueta: 'Aprobado', icon: CheckCircle2, className: 'bg-blue-50 text-blue-600' },
    issued: { etiqueta: 'Emitido', icon: Clock3, className: 'bg-emerald-50 text-emerald-600' },
    facturado: { etiqueta: 'Facturado', icon: ShieldCheck, className: 'bg-indigo-50 text-indigo-600' },
  }
  
  const currentStatus = tieneCAE ? 'facturado' : estado
  const config = configs[currentStatus] || configs.issued
  return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${config.className}`}><config.icon size={12} /> {config.etiqueta}</span>
}

function EstadoCargando() {
  return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-4" size={32} /><p className="font-black text-slate-900">Cargando presupuestos...</p></div>
}
