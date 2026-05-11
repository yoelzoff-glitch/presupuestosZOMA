'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  CalendarDays,
  User,
  FileText,
  XCircle,
  Clock3,
  CheckCircle2,
  Package,
  Globe2,
  UserRoundCog,
} from 'lucide-react'

type Order = {
  id: string
  order_number: number
  order_code: string | null
  order_date: string
  status: 'pending' | 'confirmed' | 'cancelled'
  source: 'manual' | 'portal' | string | null
  total_amount: number | null
  clients?: { name: string; cuit: string } | null
  seller_id?: string
}

type SellerProfile = { id: string; full_name: string }

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [sellers, setSellers] = useState<SellerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sellerFilter, setSellerFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all')
  const [daysFilter, setDaysFilter] = useState('30')

  useEffect(() => { loadInitialData() }, [daysFilter])

  async function loadInitialData() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }

    const { data: profile } = await supabase.from('users_profiles').select('company_id').eq('id', userData.user.id).single()
    if (!profile?.company_id) { setLoading(false); return }

    const { data: sellersData } = await supabase.from('users_profiles').select('id, full_name').eq('company_id', profile.company_id).order('full_name')
    setSellers(sellersData || [])

    await fetchOrders(profile.company_id)
  }

  async function fetchOrders(cid: string) {
    let query = supabase
      .from('orders')
      .select(`id, order_number, order_code, order_date, status, source, total_amount, seller_id, clients ( name, cuit )`)
      .eq('company_id', cid)
      .order('created_at', { ascending: false })

    if (daysFilter !== 'all') {
      const dateLimit = new Date()
      dateLimit.setDate(dateLimit.getDate() - parseInt(daysFilter))
      query = query.gte('created_at', dateLimit.toISOString())
    }

    const { data, error } = await query

    if (!error) {
      const normalized = (data || []).map((item: any) => ({ ...item, clients: Array.isArray(item.clients) ? item.clients[0] || null : item.clients || null }))
      setOrders(normalized)
    }
    setLoading(false)
  }

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase().trim()
    return orders.filter((order: any) => {
      const code = order.order_code || `PED-${order.order_number}`
      const matchesSearch = !q || code.toLowerCase().includes(q) || order.clients?.name?.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter
      const matchesSeller = sellerFilter === 'all' || order.seller_id === sellerFilter
      return matchesSearch && matchesStatus && matchesSeller
    })
  }, [orders, search, statusFilter, sellerFilter])

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-200"><ClipboardList size={14} /> Pedidos</div>
            <h1 className="text-3xl font-black tracking-tight">Órdenes de Venta</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Gestión de todos los pedidos ingresados por portal y fuerza de ventas.</p>
          </div>
          <Link href="/pedidos/nuevo" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500 active:scale-95"><Plus size={18} /> Nuevo pedido</Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={orders.length} icon={ClipboardList} tone="blue" loading={loading} />
        <StatCard title="Pendientes" value={orders.filter(o => o.status === 'pending').length} icon={Clock3} tone="amber" loading={loading} />
        <StatCard title="Convertidos" value={orders.filter(o => o.status === 'confirmed').length} icon={CheckCircle2} tone="green" loading={loading} />
        <StatCard title="Portal" value={orders.filter(o => o.source === 'portal').length} icon={Globe2} tone="blue" loading={loading} />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="space-y-4 border-b border-slate-200 p-5 bg-slate-50/30">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div><h2 className="text-xl font-black text-slate-950">Listado Maestro</h2><p className="text-sm text-slate-500">Filtrá por estado, origen o vendedor.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row items-center">
              <div className="relative"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pedido..." className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-500 sm:w-64" /></div>
              
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                 <FilterButton active={daysFilter === '7'} onClick={() => setDaysFilter('7')}>7D</FilterButton>
                 <FilterButton active={daysFilter === '30'} onClick={() => setDaysFilter('30')}>30D</FilterButton>
                 <FilterButton active={daysFilter === '90'} onClick={() => setDaysFilter('90')}>90D</FilterButton>
                 <FilterButton active={daysFilter === 'all'} onClick={() => setDaysFilter('all')}>Todo</FilterButton>
              </div>

              <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-500">
                <option value="all">Todos los vendedores</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"><option value="all">Todos los estados</option><option value="pending">Pendientes</option><option value="confirmed">Convertidos</option><option value="cancelled">Anulados</option></select>
            </div>
          </div>
        </div>

        {loading ? <LoadingState /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                <tr><th className="px-6 py-4">Pedido</th><th className="px-6 py-4">Origen</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Total</th><th className="px-6 py-4 text-right">Acción</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-blue-50/30 transition">
                    <td className="px-6 py-4 font-black text-slate-900">{order.order_code || `PED-${order.order_number}`}</td>
                    <td className="px-6 py-4"><SourceBadge source={order.source} /></td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{order.clients?.name}</td>
                    <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                    <td className="px-6 py-4 text-right font-black text-slate-950">${(order.total_amount || 0).toLocaleString('es-AR')}</td>
                    <td className="px-6 py-4 text-right"><Link href={`/pedidos/${order.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"><FileText size={14} /> Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, tone, loading }: any) {
  const styles: any = { blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', green: 'bg-emerald-50 text-emerald-700' }
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${styles[tone] || styles.blue}`}><Icon size={22} /></div>
      <div className="min-w-0"><p className="text-xs font-bold text-slate-400 truncate">{title}</p><p className="text-xl font-black text-slate-950 truncate">{loading ? '...' : value}</p></div>
    </div>
  )
}

function SourceBadge({ source }: { source: string | null }) {
  const isPortal = source === 'portal'
  return <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase ${isPortal ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>{isPortal ? <Globe2 size={12} /> : <UserRoundCog size={12} />} {isPortal ? 'Portal' : 'Manual'}</span>
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = { pending: { label: 'Pendiente', icon: Clock3, className: 'bg-amber-50 text-amber-600' }, confirmed: { label: 'Convertido', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-600' }, cancelled: { label: 'Anulado', icon: XCircle, className: 'bg-red-50 text-red-600' } }
  const config = configs[status] || configs.pending
  return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${config.className}`}><config.icon size={12} /> {config.label}</span>
}

function LoadingState() {
  return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-4" size={32} /><p className="font-black text-slate-900">Cargando pedidos...</p></div>
}
function FilterButton({ children, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={px-3 py-1.5 rounded-lg text-[10px] font-black transition-all }
    >
      {children}
    </button>
  )
}
