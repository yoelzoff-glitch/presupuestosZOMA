'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from 'lucide-react'

type Budget = {
  id: string
  budget_number: number
  budget_code: string | null
  budget_date: string | null
  total_amount: number
  paid_amount: number
}

type CascadeItem = {
  budget_id: string
  budget_label: string
  balance_before: number
  allocated_amount: number
  balance_after: number
  order: number
}

function runCascade(budgets: Budget[], amount: number): CascadeItem[] {
  const items: CascadeItem[] = []
  let remaining = amount

  for (const budget of budgets) {
    const balanceBefore = Number(budget.total_amount || 0) - Number(budget.paid_amount || 0)
    if (balanceBefore <= 0) continue

    const allocated = Math.min(remaining, balanceBefore)

    items.push({
      budget_id: budget.id,
      budget_label: budget.budget_code || `000-${budget.budget_number}`,
      balance_before: balanceBefore,
      allocated_amount: allocated,
      balance_after: balanceBefore - allocated,
      order: items.length,
    })

    remaining -= allocated
    if (remaining <= 0) break
  }

  return items
}

function fmt(value: number) {
  return Number(value || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  })
}

export default function PagarCuentaCorrientePage() {
  const router = useRouter()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [amountInput, setAmountInput] = useState('')

  const totalPending = useMemo(
    () =>
      budgets.reduce(
        (acc, b) => acc + (Number(b.total_amount || 0) - Number(b.paid_amount || 0)),
        0
      ),
    [budgets]
  )

  const amount = useMemo(() => {
    const n = parseFloat(amountInput.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }, [amountInput])

  const preview = useMemo(
    () => (amount > 0 ? runCascade(budgets, amount) : []),
    [budgets, amount]
  )

  const isAmountValid = amount > 0 && amount <= totalPending
  const remaining = Math.max(0, amount - preview.reduce((acc, i) => acc + i.allocated_amount, 0))

  useEffect(() => {
    loadBudgets()
  }, [])

  async function loadBudgets() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/auth/login')
      return
    }

    const { data: customerData } = await supabase
      .from('customer_users')
      .select('company_id, client_id, active')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (!customerData?.active || !customerData?.client_id) {
      setErrorMsg('No se pudo verificar tu acceso. Contactá al administrador.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('budgets')
      .select('id, budget_number, budget_code, budget_date, total_amount, paid_amount')
      .eq('company_id', customerData.company_id)
      .eq('client_id', customerData.client_id)
      .neq('status', 'cancelled')
      .order('budget_date', { ascending: true })
      .order('budget_number', { ascending: true })

    if (error) {
      setErrorMsg('No se pudieron cargar los presupuestos.')
      setLoading(false)
      return
    }

    // Only show budgets with pending balance
    const pending = (data || []).filter(
      (b) => Number(b.total_amount || 0) - Number(b.paid_amount || 0) > 0
    )

    setBudgets(pending)
    setLoading(false)
  }

  async function handlePay() {
    if (!isAmountValid || preview.length === 0) return

    try {
      setPaying(true)
      const response = await fetch('/api/mercadopago/create-cascade-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'No se pudo iniciar el pago.')
        return
      }

      if (data.init_point) {
        window.location.href = data.init_point
      }
    } catch (err) {
      console.error(err)
      alert('No se pudo iniciar el pago.')
    } finally {
      setPaying(false)
    }
  }

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
      <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
        <AlertCircle className="mx-auto mb-4 text-amber-600" size={40} />
        <h1 className="text-2xl font-black text-amber-900">Error</h1>
        <p className="mt-2 text-sm font-semibold text-amber-800">{errorMsg}</p>
      </div>
    )
  }

  if (budgets.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={36} />
        </div>
        <h1 className="text-2xl font-black text-slate-950">¡Todo al día!</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          No tenés presupuestos con saldo pendiente.
        </p>
        <Link
          href="/portal/presupuestos"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Volver
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-indigo-400/10 blur-3xl" />

        <div className="relative z-10">
          <Link
            href="/portal/presupuestos"
            className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 transition hover:text-white"
          >
            <ArrowLeft size={17} />
            Volver a mis presupuestos
          </Link>

          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
            <CreditCard size={14} />
            Pago en cascada
          </div>

          <h1 className="text-3xl font-black tracking-tight">Pagar saldo</h1>
          <p className="mt-2 text-sm text-slate-300">
            Ingresá el monto que querés pagar. Se distribuirá automáticamente empezando por el presupuesto más antiguo.
          </p>
        </div>
      </section>

      {/* Total pending */}
      <div className="flex items-center justify-between rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-bold text-slate-500">Saldo total pendiente</p>
          <p className="text-3xl font-black text-slate-950">{fmt(totalPending)}</p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
          <CreditCard size={26} />
        </div>
      </div>

      {/* Amount input */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
        <label className="mb-3 block text-sm font-black uppercase tracking-widest text-slate-500">
          ¿Cuánto querés pagar?
        </label>

        <div className="relative">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">
            $
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amountInput}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.,]/g, '')
              setAmountInput(val)
            }}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-5 pl-12 pr-5 text-3xl font-black text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            totalPending * 0.25,
            totalPending * 0.5,
            totalPending * 0.75,
            totalPending,
          ].map((preset) => {
            const label =
              preset === totalPending
                ? 'Todo el saldo'
                : `${Math.round((preset / totalPending) * 100)}%`
            return (
              <button
                key={label}
                type="button"
                onClick={() =>
                  setAmountInput(
                    Math.round(preset).toLocaleString('es-AR').replace(/\./g, ',')
                  )
                }
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-black text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                {label} ({fmt(preset)})
              </button>
            )
          })}
        </div>

        {amount > totalPending && (
          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-amber-600">
            <AlertCircle size={16} />
            El monto supera tu saldo total. Podés pagar hasta {fmt(totalPending)}.
          </p>
        )}
      </div>

      {/* Cascade preview */}
      {amount > 0 && preview.length > 0 && (
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="font-black text-slate-950">Distribución del pago</h2>
                <p className="text-xs font-semibold text-slate-500">
                  Así se aplicará tu pago, del más antiguo al más reciente
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {budgets
              .filter((b) => Number(b.total_amount || 0) - Number(b.paid_amount || 0) > 0)
              .map((budget, index) => {
                const balanceBefore =
                  Number(budget.total_amount || 0) - Number(budget.paid_amount || 0)
                const previewItem = preview.find((p) => p.budget_id === budget.id)
                const isAffected = !!previewItem
                const willBeFullyPaid =
                  previewItem && previewItem.balance_after <= 0
                const willBePartial =
                  previewItem &&
                  previewItem.allocated_amount > 0 &&
                  previewItem.balance_after > 0
                const untouched = !isAffected

                return (
                  <div
                    key={budget.id}
                    className={`flex items-center gap-4 p-5 transition ${
                      untouched ? 'opacity-40' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                        willBeFullyPaid
                          ? 'bg-emerald-100 text-emerald-700'
                          : willBePartial
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {index + 1}
                    </div>

                    {/* Budget info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-950">
                        {budget.budget_code || `000-${budget.budget_number}`}
                      </p>
                      <p className="text-xs font-semibold text-slate-400">
                        Saldo actual: {fmt(balanceBefore)}
                      </p>
                    </div>

                    {/* Distribution */}
                    {isAffected ? (
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Se aplica
                          </p>
                          <p className="font-black text-blue-700">
                            {fmt(previewItem!.allocated_amount)}
                          </p>
                        </div>
                        <ArrowRight size={18} className="text-slate-300" />
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Queda
                          </p>
                          <p
                            className={`font-black ${
                              previewItem!.balance_after <= 0
                                ? 'text-emerald-700'
                                : 'text-amber-600'
                            }`}
                          >
                            {previewItem!.balance_after <= 0 ? '¡Pagado!' : fmt(previewItem!.balance_after)}
                          </p>
                        </div>
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                            willBeFullyPaid
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-yellow-100 text-yellow-600'
                          }`}
                        >
                          {willBeFullyPaid ? (
                            <CheckCircle2 size={18} />
                          ) : (
                            <Clock size={18} />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-400">Sin cambios</p>
                        <XCircle size={18} className="ml-auto mt-1 text-slate-300" />
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          {/* Summary footer */}
          <div className="border-t border-slate-100 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500">Total a pagar ahora</p>
                <p className="text-2xl font-black text-slate-950">
                  {fmt(Math.min(amount, totalPending))}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-500">Presupuestos afectados</p>
                <p className="text-2xl font-black text-blue-700">{preview.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pay button */}
      <button
        type="button"
        disabled={!isAmountValid || preview.length === 0 || paying}
        onClick={handlePay}
        className="flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-blue-600 py-5 text-lg font-black text-white shadow-xl shadow-blue-900/25 transition hover:bg-blue-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {paying ? (
          <>
            <Loader2 size={22} className="animate-spin" />
            Redirigiendo a Mercado Pago...
          </>
        ) : (
          <>
            <CreditCard size={22} />
            Pagar {amount > 0 && isAmountValid ? fmt(Math.min(amount, totalPending)) : ''} con Mercado Pago
            <ChevronRight size={20} />
          </>
        )}
      </button>
    </div>
  )
}
