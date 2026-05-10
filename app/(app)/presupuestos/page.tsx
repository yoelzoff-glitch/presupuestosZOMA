'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  Eye,
  User,
  CalendarDays,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock3,
  Filter,
} from 'lucide-react'

type BudgetStatus = 'all' | 'issued' | 'approved' | 'draft' | 'cancelled'

type Budget = {
  id: string
  budget_number: number
  budget_code: string
  budget_date: string
  total_amount: number
  status: string
  payment_status: 'unpaid' | 'partial' | 'paid'
  paid_amount: number
  created_at: string
  seller_id?: string
  client: { name: string; cuit: string } | null
}

type SellerProfile = { id: string; full_name: string }

const statusFilters: { label: string; value: BudgetStatus }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Emitidos', value: 'issued' },
  { label: 'Aprobados', value: 'approved' },
  { label: 'Cancelados', value: 'cancelled' },
]

export default function PresupuestosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [sellers, setSellers] = useState<SellerProfile[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BudgetStatus>('all')
  const [sellerFilter, setSellerFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => { loadInitialData() }, [])

  async function loadInitialData() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }

    const { data: profile } = await supabase.from('users_profiles').select('company_id').eq('id', userData.user.id).single()
    if (!profile?.company_id) { setLoading(false); return }

    setCompanyId(profile.company_id)

    const { data: sellersData } = await supabase.from('users_profiles').select('id, full_name').eq('company_id', profile.company_id).order('full_name')
    setSellers(sellersData || [])

    await loadBudgets(profile.company_id)
  }

  async function loadBudgets(cid?: string) {
    const currentCid = cid || companyId
    if (!currentCid) return
    setLoading(true)

    const { data, error } = await supabase
      .from('budgets')
      .select(`id, budget_number, budget_code, budget_date, total_amount, status, payment_status, paid_amount, created_at, seller_id, clients ( name, cuit )`)
      .eq('company_id', currentCid)
      .order('budget_number', { ascending: false })

    if (error) toast.error(error.message)
    else {
      const normalized = data.map((b: any) => ({ ...b, client: Array.isArray(b.clients) ? b.clients[0] || null : b.clients || null }))
      setBudgets(normalized)
    }
    setLoading(false)
  }

  const filteredBudgets = useMemo(() => {
    const q = search.toLowerCase().trim()
    return budgets.filter((budget: any) => {
      const matchesSearch = !q || budget.budget_code?.toLowerCase().includes(q) || String(budget.budget_number).includes(q) || budget.client?.name?.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || budget.status === statusFilter
      const matchesSeller = sellerFilter === 'all' || budget.seller_id === sellerFilter
      return matchesSearch && matchesStatus && matchesSeller
    })
  }, [budgets, search, statusFilter, sellerFilter])

  const totalAmount = budgets.filter(b => b.status !== 'cancelled').reduce((acc, b) => acc + Number(b.total_amount || 0), 0)

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
        <Stat title="Total" value={budgets.length} icon={FileText} loading={loading} />
        <Stat title="Emitidos" value={budgets.filter(b => b.status === 'issued').length} icon={Clock3} loading={loading} />
        <Stat title="Aprobados" value={budgets.filter(b => b.status === 'approved').length} icon={CheckCircle2} loading={loading} />
        <Stat title="Monto Vigente" value={`$${totalAmount.toLocaleString('es-AR')}`} icon={DollarSign} loading={loading} />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="space-y-4 border-b border-slate-200 p-5 bg-slate-50/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-xl font-black text-slate-950">Listado General</h2><p className="text-sm text-slate-500">Filtrá por número, cliente o vendedor.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-500 sm:w-64" /></div>
              <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-500">
                <option value="all">Todos los vendedores</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <button onClick={() => loadBudgets()} className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map(f => <button key={f.value} onClick={() => setStatusFilter(f.value)} className={`px-4 py-2 rounded-full text-xs font-black transition ${statusFilter === f.value ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{f.label}</button>)}
          </div>
        </div>

        {loading ? <LoadingState /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                <tr><th className="px-6 py-4">Presupuesto</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4 text-right">Total</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Acción</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBudgets.map(b => (
                  <tr key={b.id} className="hover:bg-blue-50/30 transition">
                    <td className="px-6 py-4"><p className="font-black text-slate-900">{b.budget_code || `000-${b.budget_number}`}</p><p className="text-[10px] font-bold text-slate-400">{new Date(b.budget_date).toLocaleDateString()}</p></td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{b.client?.name}</td>
                    <td className="px-6 py-4 text-right font-black text-blue-700">${b.total_amount.toLocaleString('es-AR')}</td>
                    <td className="px-6 py-4"><StatusBadge status={b.status} /></td>
                    <td className="px-6 py-4 text-right"><Link href={`/presupuestos/${b.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"><Eye size={14} /> Ver</Link></td>
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

function Stat({ title, value, icon: Icon, loading }: any) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Icon size={22} /></div>
      <div className="min-w-0"><p className="text-xs font-bold text-slate-400 truncate">{title}</p><h2 className="text-xl font-black text-slate-950 truncate">{loading ? '...' : value}</h2></div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    cancelled: { label: 'Cancelado', icon: XCircle, className: 'bg-red-50 text-red-600' },
    approved: { label: 'Aprobado', icon: CheckCircle2, className: 'bg-blue-50 text-blue-600' },
    issued: { label: 'Emitido', icon: Clock3, className: 'bg-emerald-50 text-emerald-600' },
  }
  const config = configs[status] || configs.issued
  return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${config.className}`}><config.icon size={12} /> {config.label}</span>
}

function LoadingState() {
  return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-4" size={32} /><p className="font-black text-slate-900">Cargando presupuestos...</p></div>
}