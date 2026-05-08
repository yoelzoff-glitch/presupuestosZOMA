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
  Trash2,
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
  client: {
    name: string
    cuit: string
  } | null
}

const statusFilters: { label: string; value: BudgetStatus }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Emitidos', value: 'issued' },
  { label: 'Aprobados', value: 'approved' },
  { label: 'Borradores', value: 'draft' },
  { label: 'Anulados', value: 'cancelled' },
]

export default function PresupuestosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BudgetStatus>('all')
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  useEffect(() => {
    loadBudgets()
  }, [])

  async function getCompanyId() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) return null

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()

    return profile?.company_id ?? null
  }

  async function loadBudgets() {
    setLoading(true)

    const companyId = await getCompanyId()

    if (!companyId) {
      toast.error('No se encontró la empresa del usuario.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('budgets')
      .select(`
        id,
        budget_number,
        budget_code,
        budget_date,
        total_amount,
        status,
        payment_status,
        paid_amount,
        created_at,
        clients (
          name,
          cuit
        )
      `)
      .eq('company_id', companyId)
      .order('budget_number', { ascending: false })
      .range(0, 4999)

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    if (data) {
      const normalized = data.map((b: any) => ({
        ...b,
        client: Array.isArray(b.clients) ? b.clients[0] || null : b.clients || null,
      }))

      setBudgets(normalized)
    }

    setLoading(false)
  }

  async function removeBudgetImpact(budgetId: string, companyId: string) {
    const { error } = await supabase
      .from('account_movements')
      .delete()
      .eq('company_id', companyId)
      .eq('budget_id', budgetId)

    if (error) throw error
  }

  async function handleCancelBudget(budget: Budget) {
    if (budget.payment_status === 'paid' || budget.payment_status === 'partial') {
      toast.error('No se puede anular un presupuesto que ya tiene pagos registrados.')
      return
    }

    const confirmCancel = window.confirm(
      `¿Querés anular el presupuesto ${budget.budget_code || budget.budget_number}?`
    )

    if (!confirmCancel) return

    setActionLoadingId(budget.id)

    const companyId = await getCompanyId()

    if (!companyId) {
      toast.error('No se encontró la empresa del usuario.')
      setActionLoadingId(null)
      return
    }

    try {
      await removeBudgetImpact(budget.id, companyId)

      const { error } = await supabase
        .from('budgets')
        .update({ status: 'cancelled' })
        .eq('id', budget.id)
        .eq('company_id', companyId)

      if (error) throw error

      setBudgets((prev) =>
        prev.map((item) =>
          item.id === budget.id ? { ...item, status: 'cancelled' } : item
        )
      )

      toast.success('Presupuesto anulado correctamente.')
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudo anular el presupuesto.'
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDeleteBudget(budget: Budget) {
    if (budget.payment_status === 'paid' || budget.payment_status === 'partial') {
      toast.error('No se puede eliminar un presupuesto que ya tiene pagos registrados.')
      return
    }

    const confirmDelete = window.confirm(
      `¿Seguro querés eliminar el presupuesto ${
        budget.budget_code || budget.budget_number
      }? Esta acción no se puede deshacer.`
    )

    if (!confirmDelete) return

    setActionLoadingId(budget.id)

    const companyId = await getCompanyId()

    if (!companyId) {
      toast.error('No se encontró la empresa del usuario.')
      setActionLoadingId(null)
      return
    }

    try {
      await removeBudgetImpact(budget.id, companyId)

      const { error: itemsError } = await supabase
        .from('budget_items')
        .delete()
        .eq('budget_id', budget.id)

      if (itemsError) throw itemsError

      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('budget_id', budget.id)
        .eq('company_id', companyId)

      if (error) throw error

      setBudgets((prev) => prev.filter((item) => item.id !== budget.id))

      toast.success('Presupuesto eliminado correctamente.')
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el presupuesto.'
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  const filteredBudgets = useMemo(() => {
    const q = search.toLowerCase().trim()

    return budgets.filter((budget) => {
      const matchesSearch =
        !q ||
        budget.budget_code?.toLowerCase().includes(q) ||
        String(budget.budget_number).includes(q) ||
        budget.client?.name?.toLowerCase().includes(q) ||
        budget.client?.cuit?.toLowerCase().includes(q) ||
        budget.status?.toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === 'all' || budget.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [budgets, search, statusFilter])

  const activeBudgets = budgets.filter((budget) => budget.status !== 'cancelled')

  const totalAmount = activeBudgets.reduce(
    (acc, budget) => acc + Number(budget.total_amount || 0),
    0
  )

  const issuedCount = budgets.filter((b) => b.status === 'issued').length
  const approvedCount = budgets.filter((b) => b.status === 'approved').length
  const draftCount = budgets.filter((b) => b.status === 'draft').length
  const cancelledCount = budgets.filter((b) => b.status === 'cancelled').length
  function getPaymentBadge(paymentStatus?: string) {
    switch (paymentStatus) {
      case 'paid':
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            Pagado
          </span>
        )

      case 'partial':
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
            Pago parcial
          </span>
        )

      default:
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            Sin pagar
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <FileText size={14} />
              Presupuestos
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Gestión de presupuestos.
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Consultá presupuestos, filtrá por estado, revisá importes y
              administrá anulaciones o eliminaciones desde una vista más clara.
            </p>
          </div>

          <Link
            href="/presupuestos/nuevo"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
          >
            <Plus size={18} />
            Nuevo presupuesto
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        <Stat title="Total" value={budgets.length} icon={FileText} loading={loading} />
        <Stat title="Emitidos" value={issuedCount} icon={CheckCircle2} loading={loading} />
        <Stat title="Aprobados" value={approvedCount} icon={CheckCircle2} loading={loading} />
        <Stat title="Borradores" value={draftCount} icon={Clock3} loading={loading} />
        <Stat
          title="Total vigente"
          value={totalAmount.toLocaleString('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          icon={DollarSign}
          loading={loading}
        />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-slate-200 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Listado de presupuestos
              </h2>
              <p className="text-sm text-slate-500">
                Buscá por número, cliente, CUIT o estado.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar presupuesto..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:w-80"
                />
              </div>

              <button
                type="button"
                onClick={loadBudgets}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
                Actualizar
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
              <Filter size={14} />
              Estado
            </div>

            {statusFilters.map((filter) => {
              const active = statusFilter === filter.value

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${
                    active
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredBudgets.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHead>Presupuesto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead align="right">Total</TableHead>
                    <TableHead align="right">Acciones</TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredBudgets.map((budget) => (
                    <BudgetRow
                      key={budget.id}
                      budget={budget}
                      actionLoadingId={actionLoadingId}
                      onCancel={handleCancelBudget}
                      onDelete={handleDeleteBudget}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {filteredBudgets.map((budget) => (
                <BudgetMobileCard
                  key={budget.id}
                  budget={budget}
                  actionLoadingId={actionLoadingId}
                  onCancel={handleCancelBudget}
                  onDelete={handleDeleteBudget}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
function getPaymentBadge(paymentStatus?: string) {
  switch (paymentStatus) {
    case 'paid':
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
          Pagado
        </span>
      )

    case 'partial':
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
          Pago parcial
        </span>
      )

    default:
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          Sin pagar
        </span>
      )
  }
}
function BudgetRow({
  budget,
  actionLoadingId,
  onCancel,
  onDelete,
}: {
  budget: Budget
  actionLoadingId: string | null
  onCancel: (budget: Budget) => void
  onDelete: (budget: Budget) => void
}) {
  const isCancelled = budget.status === 'cancelled'
  const isActionLoading = actionLoadingId === budget.id

  return (
    <tr
      className={`transition ${
        isCancelled ? 'bg-red-50/40 opacity-75' : 'hover:bg-blue-50/40'
      }`}
    >
      <td className="px-5 py-4">
        <BudgetIdentity budget={budget} />
      </td>

      <td className="px-5 py-4">
        <ClientInfo budget={budget} />
      </td>

      <td className="px-5 py-4">
        <DateBadge date={budget.budget_date} />
      </td>

      <td className="px-5 py-4">
        <StatusBadge status={budget.status} />
      </td>

      <td className="px-5 py-4">
        {getPaymentBadge(budget.payment_status)}
      </td>

      <td
        className={`px-5 py-4 text-right text-lg font-black ${
          isCancelled ? 'text-red-600 line-through' : 'text-blue-700'
        }`}
      >
        ${Number(budget.total_amount || 0).toLocaleString('es-AR')}
      </td>

      <td className="px-5 py-4">
        <BudgetActions
          budget={budget}
          isActionLoading={isActionLoading}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      </td>
    </tr>
  )
}

function BudgetMobileCard({
  budget,
  actionLoadingId,
  onCancel,
  onDelete,
}: {
  budget: Budget
  actionLoadingId: string | null
  onCancel: (budget: Budget) => void
  onDelete: (budget: Budget) => void
}) {
  const isCancelled = budget.status === 'cancelled'
  const isActionLoading = actionLoadingId === budget.id

  return (
    <article
      className={`rounded-3xl border p-4 shadow-sm ${
        isCancelled
          ? 'border-red-100 bg-red-50/70'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <BudgetIdentity budget={budget} />
        <StatusBadge status={budget.status} />
      </div>

      <div className="mt-4 space-y-3">
        <ClientInfo budget={budget} />
        <DateBadge date={budget.budget_date} />

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            Total
          </p>
          <p
            className={`mt-1 text-2xl font-black ${
              isCancelled ? 'text-red-600 line-through' : 'text-blue-700'
            }`}
          >
            ${Number(budget.total_amount || 0).toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <BudgetActions
          budget={budget}
          isActionLoading={isActionLoading}
          onCancel={onCancel}
          onDelete={onDelete}
          mobile
        />
      </div>
    </article>
  )
}

function BudgetIdentity({ budget }: { budget: Budget }) {
  const isCancelled = budget.status === 'cancelled'

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${
          isCancelled ? 'bg-red-600' : 'bg-slate-950'
        }`}
      >
        <FileText size={20} />
      </div>

      <div>
        <p className="font-black text-slate-950">
          {budget.budget_code || `000-${budget.budget_number}`}
        </p>
        <p className="text-xs font-semibold text-slate-400">
          Nº interno {budget.budget_number}
        </p>
      </div>
    </div>
  )
}

function ClientInfo({ budget }: { budget: Budget }) {
  return (
    <div className="flex items-center gap-2">
      <User size={16} className="shrink-0 text-slate-400" />
      <div>
        <p className="font-bold text-slate-800">
          {budget.client?.name || 'Sin cliente'}
        </p>
        <p className="text-xs font-semibold text-slate-400">
          CUIT: {budget.client?.cuit || '-'}
        </p>
      </div>
    </div>
  )
}

function DateBadge({ date }: { date: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
      <CalendarDays size={15} />
      {date ? new Date(date).toLocaleDateString('es-AR') : '-'}
    </div>
  )
}

function BudgetActions({
  budget,
  isActionLoading,
  onCancel,
  onDelete,
  mobile = false,
}: {
  budget: Budget
  isActionLoading: boolean
  onCancel: (budget: Budget) => void
  onDelete: (budget: Budget) => void
  mobile?: boolean
}) {
  const isCancelled = budget.status === 'cancelled'
  const hasPayments = budget.payment_status === 'paid' || budget.payment_status === 'partial'

  return (
    <div className={`flex gap-2 ${mobile ? 'flex-col' : 'justify-end'}`}>
      <Link
        href={`/presupuestos/${budget.id}`}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      >
        <Eye size={15} />
        Ver
      </Link>

      {!isCancelled && !hasPayments && (
        <button
          type="button"
          disabled={isActionLoading}
          onClick={() => onCancel(budget)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isActionLoading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <XCircle size={15} />
          )}
          Anular
        </button>
      )}

      {!hasPayments && (
        <button
          type="button"
          disabled={isActionLoading}
          onClick={() => onDelete(budget)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isActionLoading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Trash2 size={15} />
          )}
          Eliminar
        </button>
      )}
    </div>
  )
}

function Stat({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string
  value: number | string
  icon: any
  loading: boolean
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-500">
            {title}
          </p>

          <h2 className="truncate text-[22px] font-black leading-tight text-slate-950 2xl:text-2xl">
            {loading ? '...' : value}
          </h2>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
        <XCircle size={14} />
        Anulado
      </span>
    )
  }

  if (status === 'draft') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
        <Clock3 size={14} />
        Borrador
      </span>
    )
  }

  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
        <CheckCircle2 size={14} />
        Aprobado
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
      <CheckCircle2 size={14} />
      Emitido
    </span>
  )
}

function TableHead({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
        <Loader2 size={26} className="animate-spin" />
      </div>

      <h3 className="text-lg font-black text-slate-900">
        Cargando presupuestos
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Estamos consultando la información registrada.
      </p>
    </div>
  )
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
        <FileText size={26} />
      </div>

      <h3 className="text-lg font-black text-slate-900">
        No hay presupuestos para mostrar
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {search
          ? 'Probá cambiar la búsqueda o limpiar los filtros.'
          : 'Creá un presupuesto nuevo para empezar a trabajar.'}
      </p>

      <Link
        href="/presupuestos/nuevo"
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
      >
        <Plus size={18} />
        Nuevo presupuesto
      </Link>
    </div>
  )
}