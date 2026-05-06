'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  Wallet,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  CalendarDays,
  ReceiptText,
  FileText,
  AlertCircle,
  User,
  IdCard,
  Building2,
} from 'lucide-react'

type CustomerUser = {
  id: string
  company_id: string
  client_id: string | null
  name: string
  email: string
  active: boolean
  clients: {
    id: string
    name: string
    cuit: string
  } | null
}

type Movement = {
  id: string
  client_id: string
  budget_id: string | null
  movement_date: string
  movement_type: 'Venta' | 'Pago'
  payment_type: 'Pago total' | 'Pago parcial' | 'A cuenta' | null
  description: string | null
  debit: number
  credit: number
  created_at: string
  budgets?: {
    budget_code: string | null
    budget_number: number | null
    status: string | null
  } | null
}

type PendingBudget = {
  id: string
  label: string
  total: number
  paid: number
  balance: number
}

export default function PortalCuentaCorrientePage() {
  const router = useRouter()

  const [customer, setCustomer] = useState<CustomerUser | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      router.push('/auth/login')
      return
    }

    const { data: customerData, error: customerError } = await supabase
      .from('customer_users')
      .select(`
        id,
        company_id,
        client_id,
        name,
        email,
        active,
        clients (
          id,
          name,
          cuit
        )
      `)
      .eq('auth_user_id', userData.user.id)
      .single()

    if (customerError || !customerData) {
      setErrorMsg('No se encontró el usuario cliente.')
      setLoading(false)
      return
    }

    const normalizedCustomer = {
      ...customerData,
      clients: Array.isArray(customerData.clients)
        ? customerData.clients[0] || null
        : customerData.clients || null,
    } as CustomerUser

    if (!normalizedCustomer.active) {
      setErrorMsg('Tu usuario está inactivo. Contactá al administrador.')
      setLoading(false)
      return
    }

    if (!normalizedCustomer.client_id) {
      setCustomer(normalizedCustomer)
      setErrorMsg(
        'Tu usuario todavía no tiene un cliente del sistema enlazado. Contactá al administrador.'
      )
      setLoading(false)
      return
    }

    setCustomer(normalizedCustomer)

    const { data: movementsData, error: movementsError } = await supabase
      .from('account_movements')
      .select(`
        id,
        client_id,
        budget_id,
        movement_date,
        movement_type,
        payment_type,
        description,
        debit,
        credit,
        created_at,
        budgets (
          budget_code,
          budget_number,
          status
        )
      `)
      .eq('company_id', normalizedCustomer.company_id)
      .eq('client_id', normalizedCustomer.client_id)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (movementsError) {
      setErrorMsg('No se pudieron cargar los movimientos de cuenta corriente.')
      setLoading(false)
      return
    }

    const normalizedMovements = (movementsData || []).map((item: any) => ({
      ...item,
      budgets: Array.isArray(item.budgets)
        ? item.budgets[0] || null
        : item.budgets || null,
    }))

    const visibleMovements = normalizedMovements.filter(
      (movement: Movement) => movement.budgets?.status !== 'cancelled'
    )

    setMovements(visibleMovements)
    setLoading(false)
  }

  const totals = useMemo(() => {
    const debit = movements.reduce(
      (acc, item) => acc + Number(item.debit || 0),
      0
    )

    const credit = movements.reduce(
      (acc, item) => acc + Number(item.credit || 0),
      0
    )

    return {
      debit,
      credit,
      balance: debit - credit,
    }
  }, [movements])

  const pendingBudgets = useMemo<PendingBudget[]>(() => {
    const grouped = new Map<string, PendingBudget>()

    movements.forEach((movement) => {
      if (!movement.budget_id) return

      const budgetCode =
        movement.budgets?.budget_code ||
        (movement.budgets?.budget_number
          ? `000-${movement.budgets.budget_number}`
          : 'Presupuesto')

      const current =
        grouped.get(movement.budget_id) || {
          id: movement.budget_id,
          label: budgetCode,
          total: 0,
          paid: 0,
          balance: 0,
        }

      current.total += Number(movement.debit || 0)
      current.paid += Number(movement.credit || 0)
      current.balance = current.total - current.paid

      grouped.set(movement.budget_id, current)
    })

    return Array.from(grouped.values()).filter((budget) => budget.balance > 0)
  }, [movements])

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <Loader2
            className="mx-auto mb-3 animate-spin text-blue-600"
            size={32}
          />
          <p className="font-bold text-slate-700">
            Cargando cuenta corriente...
          </p>
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

        <h1 className="text-2xl font-black text-amber-900">
          No pudimos mostrar la cuenta corriente
        </h1>

        <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
          {errorMsg}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <Wallet size={14} />
              Cuenta corriente
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Estado de cuenta
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Consultá tu saldo pendiente, presupuestos abiertos y movimientos registrados.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
          >
            Actualizar
          </button>
        </div>
      </section>

      {customer?.clients && (
        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard
            title="Cliente"
            value={customer.clients.name}
            icon={Building2}
            tone="blue"
          />

          <InfoCard
            title="CUIT"
            value={customer.clients.cuit}
            icon={IdCard}
            tone="slate"
          />

          <InfoCard
            title="Usuario"
            value={customer.email}
            icon={User}
            tone="green"
          />
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-1">
        <StatCard
          title="Saldo pendiente"
          value={formatCurrency(totals.balance)}
          icon={Wallet}
          tone={totals.balance > 0 ? 'red' : 'green'}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <aside className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-black text-slate-950">
              Presupuestos pendientes
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Saldos abiertos asociados a presupuestos.
            </p>
          </div>

          {pendingBudgets.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
                <Wallet size={28} />
              </div>

              <h3 className="font-black text-slate-900">
                Sin presupuestos pendientes
              </h3>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                No hay saldos abiertos asociados a presupuestos.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingBudgets.map((budget) => (
                <div key={budget.id} className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                      <FileText size={20} />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-950">
                        {budget.label}
                      </p>
                      <p className="text-xs font-semibold text-slate-400">
                        Presupuesto pendiente
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <MiniData
                      label="Saldo pendiente"
                      value={formatCurrency(budget.balance)}
                      strong
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-black text-slate-950">
              Movimientos
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Detalle de movimientos registrados en tu cuenta.
            </p>
          </div>

          {movements.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                <ReceiptText size={26} />
              </div>

              <h3 className="text-lg font-black text-slate-900">
                Sin movimientos
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Todavía no hay movimientos registrados.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto xl:block">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead align="right">Importe</TableHead>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {movements.map((movement) => {
                      const amount =
                        movement.movement_type === 'Venta'
                          ? Number(movement.debit || 0)
                          : Number(movement.credit || 0)

                      return (
                        <tr key={movement.id} className="hover:bg-blue-50/40">
                          <td className="px-5 py-4">
                            <DateBadge date={movement.movement_date} />
                          </td>

                          <td className="px-5 py-4">
                            <MovementBadge type={movement.movement_type} />
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-800">
                              {movement.description || '-'}
                            </p>

                            {movement.payment_type && (
                              <p className="mt-1 text-xs font-bold text-slate-400">
                                {movement.payment_type}
                              </p>
                            )}

                            {movement.budgets && (
                              <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-blue-500">
                                <FileText size={13} />
                                Presupuesto:{' '}
                                {movement.budgets.budget_code ||
                                  `000-${movement.budgets.budget_number}`}
                              </p>
                            )}
                          </td>

                          <td
                            className={`px-5 py-4 text-right text-base font-black ${
                              movement.movement_type === 'Venta'
                                ? 'text-slate-700'
                                : 'text-green-600'
                            }`}
                          >
                            {formatCurrency(amount)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 xl:hidden">
                {movements.map((movement) => {
                  const amount =
                    movement.movement_type === 'Venta'
                      ? Number(movement.debit || 0)
                      : Number(movement.credit || 0)

                  return (
                    <article
                      key={movement.id}
                      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <DateBadge date={movement.movement_date} />
                          <p className="mt-3 font-black text-slate-950">
                            {movement.description || '-'}
                          </p>

                          {movement.budgets && (
                            <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-blue-500">
                              <FileText size={13} />
                              {movement.budgets.budget_code ||
                                `000-${movement.budgets.budget_number}`}
                            </p>
                          )}
                        </div>

                        <MovementBadge type={movement.movement_type} />
                      </div>

                      <div className="mt-4">
                        <MiniData
                          label="Importe"
                          value={formatCurrency(amount)}
                          strong={movement.movement_type === 'Pago'}
                        />
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </section>
    </div>
  )
}

function InfoCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  icon: any
  tone: 'blue' | 'green' | 'slate'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles[tone]}`}
        >
          <Icon size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-500">
            {title}
          </p>
          <h2 className="truncate text-lg font-black text-slate-950">
            {value}
          </h2>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  icon: any
  tone: 'green' | 'red'
}) {
  const styles = {
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  }

  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${styles[tone]}`}
        >
          <Icon size={26} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-500">
            {title}
          </p>
          <h2 className="truncate text-3xl font-black leading-tight text-slate-950">
            {value}
          </h2>
        </div>
      </div>
    </div>
  )
}

function MiniData({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-black ${
          strong ? 'text-blue-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
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

function MovementBadge({ type }: { type: 'Venta' | 'Pago' }) {
  if (type === 'Venta') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
        <ArrowUpCircle size={14} />
        Cargo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">
      <ArrowDownCircle size={14} />
      Pago
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

function formatCurrency(value: number) {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}