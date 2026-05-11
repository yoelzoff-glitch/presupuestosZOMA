'use client'
import FilterButton from '@/app/components/FilterButton'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Wallet,
  Users,
  Search,
  Plus,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  ReceiptText,
  FileText,
  Trash2,
  CreditCard,
} from 'lucide-react'

type Client = {
  id: string
  name: string
  cuit: string
}

type Movement = {
  id: string
  client_id: string
  budget_id: string | null
  movement_date: string
  movement_type: 'Venta' | 'Pago'
  payment_type: 'Pago total' | 'Pago parcial' | 'A cuenta' | null
  payment_method: string | null
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

export default function CuentaCorrientePage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [movements, setMovements] = useState<Movement[]>([])

  const [clientSearch, setClientSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [daysFilter, setDaysFilter] = useState('30')
  const [prevBalance, setPrevBalance] = useState(0)

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [selectedPaymentBudgetId, setSelectedPaymentBudgetId] = useState('')
  const [paymentType, setPaymentType] =
    useState<'Pago total' | 'Pago parcial' | 'A cuenta'>('Pago parcial')
  const [paymentDescription, setPaymentDescription] = useState('Pago recibido')

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')

  useEffect(() => {
    initPage()
  }, [])

  useEffect(() => {
    if (selectedClientId) {
      loadMovements(selectedClientId)
      setSelectedPaymentBudgetId('')
      setPaymentAmount('')
      setPaymentType('Pago parcial')
      setPaymentDescription('Pago recibido')
    } else {
      setMovements([])
      setPrevBalance(0)
      setSelectedPaymentBudgetId('')
      setPaymentAmount('')
      setPaymentType('Pago parcial')
      setPaymentDescription('Pago recibido')
    }
  }, [selectedClientId, daysFilter])

  async function initPage() {
    setLoading(true)
    setErrorMsg('')

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setErrorMsg('No se pudo obtener el usuario logueado.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()

    if (profileError || !profile?.company_id) {
      setErrorMsg('No se pudo obtener la empresa del usuario.')
      setLoading(false)
      return
    }

    setCompanyId(profile.company_id)

    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, cuit')
      .eq('company_id', profile.company_id)
      .eq('active', true)
      .order('name', { ascending: true })

    if (clientsError) {
      setErrorMsg('Error al cargar clientes.')
      setLoading(false)
      return
    }

    setClients(clientsData || [])

    // Fetch company payment methods
    const { data: companyData } = await supabase
      .from('companies')
      .select('payment_methods')
      .eq('id', profile.company_id)
      .single()

    if (companyData?.payment_methods && Array.isArray(companyData.payment_methods)) {
      const methods = companyData.payment_methods.map((m: any) => m.name)
      setPaymentMethods(methods)
      if (methods.length > 0) setSelectedPaymentMethod(methods[0])
    }

    setLoading(false)
  }

  async function loadMovements(clientId: string) {
    if (!companyId) return
    setMovementsLoading(true)
    setErrorMsg("")
    let query = supabase.from("account_movements").select("id, client_id, budget_id, movement_date, movement_type, payment_type, payment_method, description, debit, credit, created_at, budgets ( budget_code, budget_number, status )").eq("company_id", companyId).eq("client_id", clientId).order("movement_date", { ascending: false }).order("created_at", { ascending: false })
    let previousBalance = 0
    if (daysFilter !== "all") {
      const dateLimit = new Date(); dateLimit.setDate(dateLimit.getDate() - parseInt(daysFilter))
      const isoDate = dateLimit.toISOString(); query = query.gte("created_at", isoDate)
      const { data: prevData } = await supabase.from("account_movements").select("debit, credit").eq("company_id", companyId).eq("client_id", clientId).lt("created_at", isoDate)
      previousBalance = (prevData || []).reduce((acc, m) => acc + (Number(m.debit || 0) - Number(m.credit || 0)), 0)
    }
    const { data, error } = await query
    if (error) { setErrorMsg("Error al cargar movimientos: " + error.message); setMovementsLoading(false); return }
    const normalized = (data || []).map((item: any) => ({ ...item, budgets: Array.isArray(item.budgets) ? item.budgets[0] || null : item.budgets || null }))
    setPrevBalance(previousBalance); setMovements(normalized.filter((item: any) => item.budgets?.status !== "cancelled")); setMovementsLoading(false)
  }


  const selectedClient = clients.find((c) => c.id === selectedClientId)

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim()

    if (!q) return clients

    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(q) ||
        client.cuit.toLowerCase().includes(q)
    )
  }, [clients, clientSearch])

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
      balance: prevBalance + debit - credit,
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

  const selectedPaymentBudget = pendingBudgets.find(
    (budget) => budget.id === selectedPaymentBudgetId
  )

  const pendingBudgetsTotalBalance = useMemo(() => {
    return pendingBudgets.reduce(
      (acc, budget) => acc + Number(budget.balance || 0),
      0
    )
  }, [pendingBudgets])

  const paymentFullAmount = selectedPaymentBudget
    ? selectedPaymentBudget.balance
    : pendingBudgetsTotalBalance > 0
      ? pendingBudgetsTotalBalance
      : totals.balance

  useEffect(() => {
    if (paymentType === 'Pago total') {
      setPaymentAmount(
        paymentFullAmount > 0 ? String(Number(paymentFullAmount.toFixed(2))) : ''
      )

      if (selectedPaymentBudget) {
        setPaymentDescription(`Pago completo ${selectedPaymentBudget.label}`)
      } else if (pendingBudgets.length > 0) {
        setPaymentDescription('Pago completo de presupuestos pendientes')
      } else {
        setPaymentDescription('Pago completo de deuda')
      }
    }
  }, [paymentType, paymentFullAmount, selectedPaymentBudget, pendingBudgets.length])

  async function updateBudgetPaymentStatus(budgetId: string) {
    if (!companyId || !budgetId) return

    const { data: movementsData } = await supabase
      .from('account_movements')
      .select('credit')
      .eq('company_id', companyId)
      .eq('budget_id', budgetId)

    const totalPaid =
      movementsData?.reduce((acc, curr) => acc + Number(curr.credit || 0), 0) ||
      0

    const { data: budgetData } = await supabase
      .from('budgets')
      .select('total_amount')
      .eq('id', budgetId)
      .single()

    if (budgetData) {
      const totalAmount = Number(budgetData.total_amount || 0)
      const paymentStatus =
        totalPaid <= 0
          ? 'unpaid'
          : totalPaid >= totalAmount
            ? 'paid'
            : 'partial'

      await supabase
        .from('budgets')
        .update({
          payment_status: paymentStatus,
          paid_amount: totalPaid,
        })
        .eq('id', budgetId)
    }
  }

  async function handleSavePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setErrorMsg('')
    setSuccessMsg('')

    if (!companyId) {
      setErrorMsg('No se encontró la empresa.')
      return
    }

    if (!selectedClientId) {
      setErrorMsg('Seleccioná un cliente.')
      return
    }

    const amount =
      paymentType === 'Pago total'
        ? Number(paymentFullAmount)
        : Number(paymentAmount)

    if (!amount || isNaN(amount) || amount <= 0) {
      setErrorMsg('Ingresá un monto válido.')
      return
    }

    if (selectedPaymentBudget && amount > selectedPaymentBudget.balance) {
      setErrorMsg('El pago no puede superar la deuda del presupuesto seleccionado.')
      return
    }

    if (
      paymentType !== 'Pago total' &&
      !selectedPaymentBudget &&
      amount > totals.balance
    ) {
      setErrorMsg('El pago no puede superar la deuda total del cliente.')
      return
    }

    setSavingPayment(true)

    // -----------------------------------------------------------------------
    // BRANCH 1: "Pago total" sin presupuesto → salda todos los pendientes
    // -----------------------------------------------------------------------
    if (
      paymentType === 'Pago total' &&
      !selectedPaymentBudget &&
      pendingBudgets.length > 0
    ) {
      const movementsToInsert = pendingBudgets.map((budget) => ({
        company_id: companyId,
        client_id: selectedClientId,
        budget_id: budget.id,
        movement_type: 'Pago',
        payment_type: 'Pago total',
        description: `Pago completo ${budget.label}`,
        payment_method: selectedPaymentMethod || null,
        debit: 0,
        credit: Number(budget.balance || 0),
      }))

      const { error } = await supabase
        .from('account_movements')
        .insert(movementsToInsert)

      setSavingPayment(false)

      if (error) {
        setErrorMsg('Error al registrar el pago total.')
        console.error(error)
        return
      }

      for (const budget of pendingBudgets) {
        await updateBudgetPaymentStatus(budget.id)
      }

      setSuccessMsg('Pago total registrado. Todos los presupuestos pendientes quedaron saldados.')
      setPaymentAmount('')
      setSelectedPaymentBudgetId('')
      setPaymentType('Pago parcial')
      setPaymentDescription('Pago recibido')
      setShowPaymentForm(false)

      await loadMovements(selectedClientId)
      return
    }

    // -----------------------------------------------------------------------
    // BRANCH 2: Sin presupuesto seleccionado → cascada automática
    // -----------------------------------------------------------------------
    if (!selectedPaymentBudgetId && pendingBudgets.length > 0) {
      // Sort pending budgets by date ascending (oldest first)
      // pendingBudgets already comes from movements ordered by date desc,
      // so we need to re-sort: we'll use the order from the budgets query
      // For now we sort by label (000-XXXX) ascending as a proxy for date
      const sortedBudgets = [...pendingBudgets].sort((a, b) =>
        a.label.localeCompare(b.label)
      )

      // Fetch real dates for proper ordering
      const { data: budgetDates } = await supabase
        .from('budgets')
        .select('id, budget_date, budget_number')
        .in('id', sortedBudgets.map((b) => b.id))

      const dateMap = new Map(
        (budgetDates || []).map((b) => [b.id, b.budget_date || '9999-12-31'])
      )

      const orderedBudgets = [...pendingBudgets].sort((a, b) => {
        const da = dateMap.get(a.id) || '9999-12-31'
        const db = dateMap.get(b.id) || '9999-12-31'
        return da.localeCompare(db)
      })

      // Run cascade algorithm
      const cascadeItems: Array<{
        budget_id: string
        label: string
        allocated: number
        paymentType: 'Pago total' | 'Pago parcial'
      }> = []

      let remaining = amount

      for (const budget of orderedBudgets) {
        if (remaining <= 0) break
        const allocated = Math.min(remaining, budget.balance)
        cascadeItems.push({
          budget_id: budget.id,
          label: budget.label,
          allocated,
          paymentType: allocated >= budget.balance ? 'Pago total' : 'Pago parcial',
        })
        remaining -= allocated
      }

      // Insert one movement per affected budget
      const movementsToInsert = cascadeItems.map((item) => ({
        company_id: companyId,
        client_id: selectedClientId,
        budget_id: item.budget_id,
        movement_type: 'Pago',
        payment_type: item.paymentType,
        description:
          paymentDescription.trim() ||
          `Pago ${item.paymentType === 'Pago total' ? 'completo' : 'parcial'} ${item.label}`,
        payment_method: selectedPaymentMethod || null,
        debit: 0,
        credit: item.allocated,
      }))

      const { error } = await supabase
        .from('account_movements')
        .insert(movementsToInsert)

      setSavingPayment(false)

      if (error) {
        setErrorMsg('Error al registrar el pago en cascada.')
        console.error(error)
        return
      }

      for (const item of cascadeItems) {
        await updateBudgetPaymentStatus(item.budget_id)
      }

      const affected = cascadeItems.length
      setSuccessMsg(
        `Pago registrado. Se distribuyó en cascada entre ${affected} presupuesto${affected !== 1 ? 's' : ''} (del más antiguo al más reciente).`
      )
      setPaymentAmount('')
      setSelectedPaymentBudgetId('')
      setPaymentType('Pago parcial')
      setPaymentDescription('Pago recibido')
      setShowPaymentForm(false)

      await loadMovements(selectedClientId)
      return
    }

    // -----------------------------------------------------------------------
    // BRANCH 3: Con presupuesto seleccionado → pago directo al presupuesto
    // -----------------------------------------------------------------------
    const { error } = await supabase.from('account_movements').insert({
      company_id: companyId,
      client_id: selectedClientId,
      budget_id: selectedPaymentBudgetId || null,
      movement_type: 'Pago',
      payment_type: paymentType,
      description:
        paymentDescription.trim() ||
        (selectedPaymentBudget
          ? `Pago ${selectedPaymentBudget.label}`
          : 'Pago recibido'),
      payment_method: selectedPaymentMethod || null,
      debit: 0,
      credit: amount,
    })

    setSavingPayment(false)

    if (error) {
      setErrorMsg('Error al registrar el pago.')
      console.error(error)
      return
    }

    if (selectedPaymentBudgetId) {
      await updateBudgetPaymentStatus(selectedPaymentBudgetId)
    }

    setSuccessMsg('Pago registrado correctamente.')
    setPaymentAmount('')
    setSelectedPaymentBudgetId('')
    setPaymentType('Pago parcial')
    setPaymentDescription('Pago recibido')
    setShowPaymentForm(false)

    await loadMovements(selectedClientId)
  }


  async function handleDeleteMovement(movementId: string, budgetId: string | null) {
    if (!companyId) return

    const confirmDelete = window.confirm(
      '¿Estás seguro de que querés eliminar este movimiento? Si es un pago, el presupuesto asociado volverá a quedar pendiente.'
    )

    if (!confirmDelete) return

    setDeletingId(movementId)

    try {
      const { error } = await supabase
        .from('account_movements')
        .delete()
        .eq('id', movementId)
        .eq('company_id', companyId)

      if (error) throw error

      if (budgetId) {
        await updateBudgetPaymentStatus(budgetId)
      }

      setSuccessMsg('Movimiento eliminado correctamente.')
      await loadMovements(selectedClientId)
    } catch (err) {
      console.error(err)
      setErrorMsg('No se pudo eliminar el movimiento.')
    } finally {
      setDeletingId(null)
    }
  }

  function handleBudgetSelection(budgetId: string) {
    setSelectedPaymentBudgetId(budgetId)

    const budget = pendingBudgets.find((item) => item.id === budgetId)

    if (budget) {
      setPaymentDescription(`Pago ${budget.label}`)

      if (paymentType === 'Pago total') {
        setPaymentAmount(String(Number(budget.balance.toFixed(2))))
      }
    } else {
      setPaymentDescription('Pago recibido')

      if (paymentType === 'Pago total') {
        setPaymentAmount(
          paymentFullAmount > 0 ? String(Number(paymentFullAmount.toFixed(2))) : ''
        )
      }
    }
  }

  function handlePaymentTypeChange(
    nextType: 'Pago total' | 'Pago parcial' | 'A cuenta'
  ) {
    setPaymentType(nextType)

    if (nextType === 'Pago total') {
      setPaymentAmount(
        paymentFullAmount > 0 ? String(Number(paymentFullAmount.toFixed(2))) : ''
      )

      if (selectedPaymentBudget) {
        setPaymentDescription(`Pago completo ${selectedPaymentBudget.label}`)
      } else if (pendingBudgets.length > 0) {
        setPaymentDescription('Pago completo de presupuestos pendientes')
      } else {
        setPaymentDescription('Pago completo de deuda')
      }
    }

    if (nextType === 'Pago parcial') {
      if (selectedPaymentBudget) {
        setPaymentDescription(`Pago parcial ${selectedPaymentBudget.label}`)
      } else {
        setPaymentDescription('Pago recibido')
      }
    }

    if (nextType === 'A cuenta') {
      if (selectedPaymentBudget) {
        setPaymentDescription(`Pago a cuenta ${selectedPaymentBudget.label}`)
      } else {
        setPaymentDescription('Pago a cuenta')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 font-bold text-slate-700 shadow-sm">
          <Loader2 className="animate-spin text-blue-600" size={22} />
          Cargando cuenta corriente...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
            <Wallet size={14} />
            Cuenta corriente
          </div>

          <h1 className="text-3xl font-black tracking-tight">
            Movimientos de clientes
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Registrá ventas, pagos y consultá el saldo pendiente de cada cliente.
          </p>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
          {successMsg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
              <Users size={22} className="text-blue-600" />
              Clientes
            </h2>

            <div className="relative mt-4">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar cliente o CUIT..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto p-3">
            {filteredClients.length === 0 ? (
              <div className="p-6 text-center text-sm font-bold text-slate-500">
                No hay clientes para mostrar.
              </div>
            ) : (
              filteredClients.map((client) => {
                const active = selectedClientId === client.id

                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`mb-2 w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-blue-300 bg-blue-50 text-blue-900'
                        : 'border-slate-100 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-black">{client.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      CUIT: {client.cuit}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section className="space-y-5">
          {!selectedClient ? (
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
                <Wallet size={30} />
              </div>

              <h2 className="text-xl font-black text-slate-950">
                Seleccioná un cliente
              </h2>

              <p className="mt-2 text-sm font-medium text-slate-500">
                Al elegir un cliente vas a ver sus movimientos, pagos y saldo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col min-w-0 gap-6">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-500">
                      Cuenta corriente de
                    </p>
                    <h2 className="text-2xl font-black text-slate-950">
                      {selectedClient.name}
                    </h2>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                         <FilterButton active={daysFilter === '7'} onClick={() => setDaysFilter('7')}>7D</FilterButton>
                         <FilterButton active={daysFilter === '30'} onClick={() => setDaysFilter('30')}>30D</FilterButton>
                         <FilterButton active={daysFilter === '90'} onClick={() => setDaysFilter('90')}>90D</FilterButton>
                         <FilterButton active={daysFilter === 'all'} onClick={() => setDaysFilter('all')}>Todo</FilterButton>
                      </div>
                      <p className="text-xs font-bold text-slate-400">
                        CUIT: {selectedClient.cuit}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentForm(!showPaymentForm)
                      setErrorMsg('')
                      setSuccessMsg('')
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700"
                  >
                    <Plus size={18} />
                    Registrar pago
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  title="Total vendido"
                  value={formatCurrency(totals.debit)}
                  icon={ArrowUpCircle}
                  tone="blue"
                />

                <StatCard
                  title="Total pagado"
                  value={formatCurrency(totals.credit)}
                  icon={ArrowDownCircle}
                  tone="green"
                />

                <StatCard
                  title="Saldo pendiente"
                  value={formatCurrency(totals.balance)}
                  icon={Wallet}
                  tone={totals.balance > 0 ? 'red' : 'green'}
                />
              </div>

              {showPaymentForm && (
                <form
                  onSubmit={handleSavePayment}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">
                        Registrar pago
                      </h3>
                      <p className="text-sm font-semibold text-slate-500">
                        Podés asociar el pago a un presupuesto pendiente o usar pago total para saldar todos.
                      </p>
                    </div>

                    {selectedPaymentBudget ? (
                      <div className="rounded-2xl bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
                        Deuda: {formatCurrency(selectedPaymentBudget.balance)}
                      </div>
                    ) : paymentType === 'Pago total' && pendingBudgets.length > 0 ? (
                      <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
                        Saldará {pendingBudgets.length} presupuesto
                        {pendingBudgets.length === 1 ? '' : 's'} pendiente
                        {pendingBudgets.length === 1 ? '' : 's'}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block xl:col-span-2">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Presupuesto asociado
                      </span>

                      <select
                        value={selectedPaymentBudgetId}
                        onChange={(e) => handleBudgetSelection(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="">
                          {paymentType === 'Pago total'
                            ? 'Sin asociar: saldar todos los pendientes'
                            : 'Sin asociar a presupuesto'}
                        </option>

                        {pendingBudgets.map((budget) => (
                          <option key={budget.id} value={budget.id}>
                            {budget.label} - deuda {formatCurrency(budget.balance)}
                          </option>
                        ))}
                      </select>

                      {pendingBudgets.length === 0 && (
                        <p className="mt-2 text-xs font-bold text-slate-400">
                          Este cliente no tiene presupuestos pendientes para asociar.
                        </p>
                      )}

                      {paymentType !== 'Pago total' &&
                        !selectedPaymentBudget &&
                        pendingBudgets.length > 0 && (
                          <p className="mt-2 text-xs font-bold text-blue-600">
                            ⚡ Sin presupuesto asignado: el monto se distribuirá en cascada del más antiguo al más reciente.
                          </p>
                        )}

                      {paymentType === 'Pago total' &&
                        !selectedPaymentBudget &&
                        pendingBudgets.length > 0 && (
                          <p className="mt-2 text-xs font-bold text-emerald-600">
                            Al no elegir un presupuesto puntual, se generará un pago por cada presupuesto pendiente.
                          </p>
                        )}
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Tipo de pago
                      </span>

                      <select
                        value={paymentType}
                        onChange={(e) =>
                          handlePaymentTypeChange(
                            e.target.value as
                              | 'Pago total'
                              | 'Pago parcial'
                              | 'A cuenta'
                          )
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="Pago parcial">Pago parcial</option>
                        <option value="Pago total">Pago total</option>
                        <option value="A cuenta">A cuenta</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Monto
                      </span>

                      <input
                        type="number"
                        value={paymentAmount}
                        readOnly={paymentType === 'Pago total'}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="Ej: 15000"
                        className={`w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${
                          paymentType === 'Pago total'
                            ? 'cursor-not-allowed bg-slate-100 text-slate-500'
                            : 'bg-slate-50'
                        }`}
                      />

                      {paymentType === 'Pago total' && (
                        <p className="mt-2 text-xs font-bold text-blue-600">
                          Se completa automáticamente con la deuda{' '}
                          {selectedPaymentBudget
                            ? 'del presupuesto'
                            : pendingBudgets.length > 0
                              ? 'de todos los presupuestos pendientes'
                              : 'total del cliente'}
                          .
                        </p>
                      )}
                    </label>

                    <label className="block xl:col-span-4">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Descripción
                      </span>

                      <input
                        value={paymentDescription}
                        onChange={(e) => setPaymentDescription(e.target.value)}
                        placeholder="Pago recibido"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </label>

                    <label className="block xl:col-span-2">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Método de pago
                      </span>

                      <select
                        value={selectedPaymentMethod}
                        onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="">Sin especificar</option>
                        {paymentMethods.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPaymentForm(false)
                        setPaymentAmount('')
                        setSelectedPaymentBudgetId('')
                        setPaymentType('Pago parcial')
                        setPaymentDescription('Pago recibido')
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={savingPayment}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {savingPayment && (
                        <Loader2 size={18} className="animate-spin" />
                      )}
                      {savingPayment ? 'Guardando...' : 'Guardar pago'}
                    </button>
                  </div>
                </form>
              )}

              <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                  <h3 className="text-lg font-black text-slate-950">
                    Movimientos
                  </h3>
                  <p className="text-sm font-medium text-slate-500">
                    Detalle de ventas, pagos y saldos del cliente.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  {movementsLoading ? (
                    <div className="flex items-center justify-center gap-3 p-10 text-sm font-bold text-slate-500">
                      <Loader2 className="animate-spin text-blue-600" />
                      Cargando movimientos...
                    </div>
                  ) : movements.length === 0 ? (
                    <div className="p-10 text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                        <ReceiptText size={26} />
                      </div>

                      <h3 className="text-lg font-black text-slate-900">
                        Sin movimientos
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Este cliente todavía no tiene ventas ni pagos cargados.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full min-w-[750px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                            Fecha
                          </th>
                          <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                            Tipo
                          </th>
                          <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                            Descripción
                          </th>
                          <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                            Debe
                          </th>
                          <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                            Haber
                          </th>
                          <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                            Acciones
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {movements.map((movement) => (
                          <tr key={movement.id} className="hover:bg-blue-50/40">
                            <td className="px-5 py-4">
                              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                                <CalendarDays size={15} />
                                {new Date(
                                  movement.movement_date
                                ).toLocaleDateString('es-AR')}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              {movement.movement_type === 'Venta' ? (
                                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                                  <ArrowUpCircle size={14} />
                                  Venta
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">
                                  <ArrowDownCircle size={14} />
                                  Pago
                                </span>
                              )}
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

                              {movement.payment_method && (
                                <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                                  <CreditCard size={13} />
                                  Método: {movement.payment_method}
                                </p>
                              )}
                            </td>

                            <td className="px-5 py-4 text-right text-base font-black text-red-600">
                              {Number(movement.debit || 0) > 0
                                ? formatCurrency(Number(movement.debit))
                                : '-'}
                            </td>

                            <td className="px-5 py-4 text-right text-base font-black text-green-600">
                              {Number(movement.credit || 0) > 0
                                ? formatCurrency(Number(movement.credit))
                                : '-'}
                            </td>

                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteMovement(
                                    movement.id,
                                    movement.budget_id
                                  )
                                }
                                disabled={deletingId === movement.id}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                                title="Eliminar movimiento"
                              >
                                {deletingId === movement.id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
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
  tone: 'blue' | 'green' | 'red'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  }

  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${styles[tone]}`}
        >
          <Icon size={23} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-500">{title}</p>
          <h2 className="truncate text-[22px] font-black leading-tight text-slate-950">
            {value}
          </h2>
        </div>
      </div>
    </div>
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
