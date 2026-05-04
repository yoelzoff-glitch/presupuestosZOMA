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

export default function PresupuestosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [search, setSearch] = useState('')
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

  async function handleCancelBudget(budget: Budget) {
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

    const { error } = await supabase
      .from('budgets')
      .update({ status: 'cancelled' })
      .eq('id', budget.id)
      .eq('company_id', companyId)

    setActionLoadingId(null)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Presupuesto anulado correctamente.')

    setBudgets((prev) =>
      prev.map((item) =>
        item.id === budget.id ? { ...item, status: 'cancelled' } : item
      )
    )
  }

  async function handleDeleteBudget(budget: Budget) {
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

    // Primero borra los ítems del presupuesto si existen.
    // Si tu tabla se llama distinto, cambiá "budget_items" por el nombre correcto.
    const { error: itemsError } = await supabase
      .from('budget_items')
      .delete()
      .eq('budget_id', budget.id)

    if (itemsError) {
      setActionLoadingId(null)
      toast.error(itemsError.message)
      return
    }

    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budget.id)
      .eq('company_id', companyId)

    setActionLoadingId(null)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Presupuesto eliminado correctamente.')

    setBudgets((prev) => prev.filter((item) => item.id !== budget.id))
  }

  const filteredBudgets = useMemo(() => {
    const q = search.toLowerCase().trim()

    if (!q) return budgets

    return budgets.filter((budget) => {
      return (
        budget.budget_code?.toLowerCase().includes(q) ||
        String(budget.budget_number).includes(q) ||
        budget.client?.name?.toLowerCase().includes(q) ||
        budget.client?.cuit?.toLowerCase().includes(q) ||
        budget.status?.toLowerCase().includes(q)
      )
    })
  }, [budgets, search])

  const totalAmount = budgets
    .filter((budget) => budget.status !== 'cancelled')
    .reduce((acc, budget) => acc + Number(budget.total_amount || 0), 0)

  const issuedCount = budgets.filter((b) => b.status === 'issued').length
  const cancelledCount = budgets.filter((b) => b.status === 'cancelled').length

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
              Gestión de presupuestos
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Consultá presupuestos emitidos, anulá los que no fueron aprobados
              o eliminá los que no quieras conservar.
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

      <section className="grid gap-4 md:grid-cols-4">
        <Stat
          title="Presupuestos"
          value={budgets.length}
          icon={FileText}
          loading={loading}
        />

        <Stat
          title="Emitidos"
          value={issuedCount}
          icon={CheckCircle2}
          loading={loading}
        />

        <Stat
          title="Anulados"
          value={cancelledCount}
          icon={XCircle}
          loading={loading}
        />

        <Stat
          title="Total vigente"
          value={`$${totalAmount.toLocaleString('es-AR')}`}
          icon={DollarSign}
          loading={loading}
        />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
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
              onClick={loadBudgets}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={17} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-sm font-bold text-slate-500">
              Cargando presupuestos...
            </div>
          ) : filteredBudgets.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                <FileText size={26} />
              </div>

              <h3 className="text-lg font-black text-slate-900">
                No hay presupuestos para mostrar
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Creá un presupuesto nuevo o cambiá la búsqueda.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[1050px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Presupuesto
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Cliente
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Fecha
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Estado
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                    Total
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredBudgets.map((budget) => {
                  const isCancelled = budget.status === 'cancelled'
                  const isActionLoading = actionLoadingId === budget.id

                  return (
                    <tr
                      key={budget.id}
                      className={`transition ${
                        isCancelled
                          ? 'bg-red-50/40 opacity-75'
                          : 'hover:bg-blue-50/40'
                      }`}
                    >
                      <td className="px-5 py-4">
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
                              {budget.budget_code ||
                                `000-${budget.budget_number}`}
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Nº interno {budget.budget_number}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-slate-400" />
                          <div>
                            <p className="font-bold text-slate-800">
                              {budget.client?.name || 'Sin cliente'}
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              CUIT: {budget.client?.cuit || '-'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                          <CalendarDays size={15} />
                          {budget.budget_date
                            ? new Date(
                                budget.budget_date
                              ).toLocaleDateString('es-AR')
                            : '-'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={budget.status} />
                      </td>

                      <td
                        className={`px-5 py-4 text-right text-lg font-black ${
                          isCancelled ? 'text-red-600' : 'text-blue-700'
                        }`}
                      >
                        ${Number(budget.total_amount || 0).toLocaleString('es-AR')}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/presupuestos/${budget.id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Eye size={15} />
                            Ver
                          </Link>

                          {!isCancelled && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleCancelBudget(budget)}
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

                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handleDeleteBudget(budget)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isActionLoading ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon size={22} />
        </div>

        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <h2 className="text-2xl font-black text-slate-950">
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
        <FileText size={14} />
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