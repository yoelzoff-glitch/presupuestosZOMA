'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  FileText,
  Loader2,
  CalendarDays,
  DollarSign,
  Eye,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react'

type Budget = {
  id: string
  budget_number: number
  budget_code: string | null
  budget_date: string | null
  total_amount: number | null
  paid_amount: number | null
  status: string | null
}

type PaymentStatus = 'paid' | 'partial' | 'unpaid'

function getPaymentStatus(budget: Budget): PaymentStatus {
  const total = Number(budget.total_amount || 0)
  const paid = Number(budget.paid_amount || 0)
  if (paid >= total && total > 0) return 'paid'
  if (paid > 0 && paid < total) return 'partial'
  return 'unpaid'
}

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'paid', label: 'Pagado' },
  { value: 'partial', label: 'Pago parcial' },
  { value: 'unpaid', label: 'Sin pagar' },
  { value: 'cancelled', label: 'Anulados' },
]

export default function PortalPresupuestosPage() {
  const router = useRouter()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [search, setSearch] = useState('')
  const [payFilter, setPayFilter] = useState('all')

  useEffect(() => {
    loadBudgets()
  }, [])

  async function loadBudgets() {
    setLoading(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/auth/login')
      return
    }

    // Get customer data (client_id and company_id)
    const { data: customerData, error: customerError } = await supabase
      .from('customer_users')
      .select('company_id, client_id, active')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (customerError || !customerData) {
      setErrorMsg('No se encontró el usuario cliente.')
      setLoading(false)
      return
    }

    if (!customerData.active) {
      setErrorMsg('Tu usuario está inactivo. Contactá al administrador.')
      setLoading(false)
      return
    }

    if (!customerData.client_id) {
      setErrorMsg('Tu usuario no tiene un cliente enlazado. Contactá al administrador.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('budgets')
      .select('id, budget_number, budget_code, budget_date, total_amount, paid_amount, status')
      .eq('company_id', customerData.company_id)
      .eq('client_id', customerData.client_id)
      .order('budget_number', { ascending: false })

    if (error) {
      setErrorMsg('No se pudieron cargar los presupuestos.')
      setLoading(false)
      return
    }

    setBudgets(data || [])
    setLoading(false)
  }

  const filtered = budgets.filter((b) => {
    const label = b.budget_code || `000-${b.budget_number}`
    const matchSearch = label.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false

    if (payFilter === 'all') return true
    if (payFilter === 'cancelled') return b.status === 'cancelled'

    if (b.status === 'cancelled') return false
    return getPaymentStatus(b) === payFilter
  })

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" size={32} />
          <p className="font-bold text-slate-700">Cargando presupuestos...</p>
        </div>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-700">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-black text-amber-900">No pudimos mostrar tus presupuestos</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">{errorMsg}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-indigo-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <FileText size={14} />
              Mis presupuestos
            </div>
            <h1 className="text-3xl font-black tracking-tight">Presupuestos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Consultá el estado de todos tus presupuestos y seguí el estado de cada pago.
            </p>
          </div>

          <button
            type="button"
            onClick={loadBudgets}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total"
          value={budgets.filter((b) => b.status !== 'cancelled').length}
          color="slate"
        />
        <StatCard
          label="Pagados"
          value={budgets.filter((b) => b.status !== 'cancelled' && getPaymentStatus(b) === 'paid').length}
          color="green"
        />
        <StatCard
          label="Pago parcial"
          value={budgets.filter((b) => b.status !== 'cancelled' && getPaymentStatus(b) === 'partial').length}
          color="yellow"
        />
        <StatCard
          label="Sin pagar"
          value={budgets.filter((b) => b.status !== 'cancelled' && getPaymentStatus(b) === 'unpaid').length}
          color="red"
        />
      </section>

      {/* Table card */}
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Listado</h2>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">
              {filtered.length} presupuesto{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por número..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-52"
              />
            </div>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <SlidersHorizontal size={14} className="text-slate-400" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setPayFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-xs font-black transition ${
                payFilter === f.value
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="p-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
              <FileText size={24} />
            </div>
            <h3 className="font-black text-slate-900">Sin resultados</h3>
            <p className="mt-1 text-sm text-slate-500">
              No hay presupuestos que coincidan con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[700px]">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Presupuesto</Th>
                    <Th>Fecha</Th>
                    <Th>Estado</Th>
                    <Th>Pago</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Acciones</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((budget) => {
                    const label = budget.budget_code || `000-${budget.budget_number}`
                    const payStatus = getPaymentStatus(budget)
                    const isCancelled = budget.status === 'cancelled'
                    return (
                      <tr key={budget.id} className="transition hover:bg-blue-50/30">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white ${isCancelled ? 'bg-red-500' : 'bg-slate-900'}`}>
                              <FileText size={18} />
                            </div>
                            <div>
                              <p className="font-black text-slate-950">{label}</p>
                              <p className="text-xs font-semibold text-slate-400">Nº interno {budget.budget_number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                            <CalendarDays size={14} />
                            {budget.budget_date ? new Date(budget.budget_date).toLocaleDateString('es-AR') : '-'}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <BudgetStatusBadge status={budget.status} />
                        </td>
                        <td className="px-5 py-4">
                          {!isCancelled && <PaymentBadge status={payStatus} />}
                        </td>
                        <td className={`px-5 py-4 text-right text-lg font-black ${isCancelled ? 'text-red-500 line-through' : 'text-blue-700'}`}>
                          ${Number(budget.total_amount || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/portal/presupuestos/${budget.id}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Eye size={15} />
                            Ver
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 p-4 lg:hidden">
              {filtered.map((budget) => {
                const label = budget.budget_code || `000-${budget.budget_number}`
                const payStatus = getPaymentStatus(budget)
                const isCancelled = budget.status === 'cancelled'
                return (
                  <article
                    key={budget.id}
                    className={`rounded-3xl border p-4 shadow-sm ${isCancelled ? 'border-red-100 bg-red-50/60' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${isCancelled ? 'bg-red-500' : 'bg-slate-900'}`}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="font-black text-slate-950">{label}</p>
                          <p className="text-xs font-semibold text-slate-400">Nº {budget.budget_number}</p>
                        </div>
                      </div>
                      <BudgetStatusBadge status={budget.status} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Fecha</p>
                        <p className="mt-1 text-sm font-bold text-slate-700">
                          {budget.budget_date ? new Date(budget.budget_date).toLocaleDateString('es-AR') : '-'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total</p>
                        <p className={`mt-1 text-lg font-black ${isCancelled ? 'text-red-500 line-through' : 'text-blue-700'}`}>
                          ${Number(budget.total_amount || 0).toLocaleString('es-AR')}
                        </p>
                      </div>
                    </div>

                    {!isCancelled && (
                      <div className="mt-3">
                        <PaymentBadge status={payStatus} />
                      </div>
                    )}

                    <Link
                      href={`/portal/presupuestos/${budget.id}`}
                      className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Eye size={16} />
                      Ver detalle
                    </Link>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'slate' | 'green' | 'yellow' | 'red' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700',
  }
  const icons = {
    slate: <DollarSign size={20} />,
    green: <CheckCircle2 size={20} />,
    yellow: <Clock size={20} />,
    red: <XCircle size={20} />,
  }

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 inline-flex items-center justify-center rounded-2xl p-2.5 ${colors[color]}`}>
        {icons[color]}
      </div>
      <p className="text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-500">{label}</p>
    </div>
  )
}

function BudgetStatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case 'issued':
      return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700"><CheckCircle2 size={13} />Emitido</span>
    case 'approved':
      return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700"><CheckCircle2 size={13} />Aprobado</span>
    case 'cancelled':
      return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700"><XCircle size={13} />Anulado</span>
    default:
      return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600"><Clock size={13} />Borrador</span>
  }
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case 'paid':
      return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700"><CheckCircle2 size={13} />Pagado</span>
    case 'partial':
      return <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-black text-yellow-700"><Clock size={13} />Pago parcial</span>
    default:
      return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700"><XCircle size={13} />Sin pagar</span>
  }
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}
