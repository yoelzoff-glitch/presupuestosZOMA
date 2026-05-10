'use client'

import { useEffect, useMemo, useState } from 'react'
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

type Budget = {
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

export default function VendedorPresupuestosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    loadBudgets()
  }, [])

  async function loadBudgets() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    
    setRole(profile?.role || 'vendedor')
    const isAdmin = profile?.role === 'admin'

    let query = supabase
      .from('budgets')
      .select(`
        id, budget_number, budget_code, budget_date, total_amount, status, created_at,
        clients ( name, cuit )
      `)
      .order('budget_number', { ascending: false })

    if (!isAdmin) {
      query = query.eq('seller_id', userData.user.id)
    }

    const { data, error } = await query

    if (!error && data) {
      const normalized = data.map((b: any) => ({
        ...b,
        client: Array.isArray(b.clients) ? b.clients[0] || null : b.clients || null,
      }))
      setBudgets(normalized)
    }
    
    setLoading(false)
  }

  const filteredBudgets = useMemo(() => {
    const q = search.toLowerCase().trim()
    return budgets.filter((b) => {
      const matchesSearch = !q || 
        b.budget_code?.toLowerCase().includes(q) ||
        String(b.budget_number).includes(q) ||
        b.client?.name?.toLowerCase().includes(q)
      
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [budgets, search, statusFilter])

  const totalAmount = budgets
    .filter(b => b.status !== 'cancelled')
    .reduce((acc, b) => acc + Number(b.total_amount || 0), 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <Loader2 size={40} className="animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 font-bold">Cargando presupuestos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-slate-900">Presupuestos</h1>
            {role === 'admin' && (
              <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck size={10} /> Admin
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 font-medium text-emerald-600 flex items-center gap-1.5">
            <TrendingUp size={14} /> {role === 'admin' ? 'Facturación potencial global' : 'Mi total vigente'}: ${totalAmount.toLocaleString('es-AR')}
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Número o cliente..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition shadow-sm"
            />
          </div>
          <button
            onClick={() => { setRefreshing(true); loadBudgets().then(() => setRefreshing(false)); }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {['all', 'issued', 'approved', 'cancelled'].map((val) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition whitespace-nowrap ${
                statusFilter === val 
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
        {filteredBudgets.length === 0 ? (
          <div className="bg-white p-12 rounded-[2rem] border border-dashed border-slate-300 text-center">
            <FileText size={40} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold">No se encontraron presupuestos.</p>
          </div>
        ) : (
          filteredBudgets.map((budget) => (
            <article 
              key={budget.id} 
              className={`bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm hover:shadow-md transition group relative overflow-hidden ${
                budget.status === 'cancelled' ? 'opacity-60 grayscale' : ''
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
                        {budget.budget_code || `000-${budget.budget_number}`}
                      </h3>
                      <StatusBadge status={budget.status} />
                    </div>
                    <p className="text-sm font-bold text-slate-600 truncate flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      {budget.client?.name || 'Cliente sin nombre'}
                    </p>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto Final</p>
                  <p className="text-2xl font-black text-blue-700 leading-none">
                    ${Number(budget.total_amount).toLocaleString('es-AR')}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1.5 rounded-lg">
                    <CalendarDays size={14} />
                    {new Date(budget.budget_date).toLocaleDateString()}
                  </div>
                  <div className="sm:hidden font-black text-blue-700 text-base">
                    ${Number(budget.total_amount).toLocaleString('es-AR')}
                  </div>
                </div>
                <Link 
                  href={`/vendedor/presupuestos/${budget.id}`}
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

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    issued: { label: 'Emitido', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Clock3 },
    approved: { label: 'Aprobado', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2 },
    cancelled: { label: 'Anulado', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  }
  const config = configs[status] || configs.issued
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border ${config.color}`}>
      <config.icon size={10} />
      {config.label}
    </span>
  )
}
