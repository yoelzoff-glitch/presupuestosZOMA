'use client'

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
  description: string | null
  debit: number
  credit: number
  created_at: string
  budgets?: {
    budget_code: string | null
    budget_number: number | null
  } | null
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

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentType, setPaymentType] =
    useState<'Pago total' | 'Pago parcial' | 'A cuenta'>('Pago parcial')
  const [paymentDescription, setPaymentDescription] = useState('Pago recibido')

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    initPage()
  }, [])

  useEffect(() => {
    if (selectedClientId) {
      loadMovements(selectedClientId)
    } else {
      setMovements([])
    }
  }, [selectedClientId])

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
    setLoading(false)
  }

  async function loadMovements(clientId: string) {
    if (!companyId) return

    setMovementsLoading(true)
    setErrorMsg('')

    const { data, error } = await supabase
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
          budget_number
        )
      `)
      .eq('company_id', companyId)
      .eq('client_id', clientId)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMsg('Error al cargar movimientos.')
      setMovementsLoading(false)
      return
    }

    const normalized = (data || []).map((item: any) => ({
      ...item,
      budgets: Array.isArray(item.budgets)
        ? item.budgets[0] || null
        : item.budgets || null,
    }))

    setMovements(normalized)
    setMovementsLoading(false)
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

    const amount = Number(paymentAmount)

    if (!paymentAmount || isNaN(amount) || amount <= 0) {
      setErrorMsg('Ingresá un monto válido.')
      return
    }

    setSavingPayment(true)

    const { error } = await supabase.from('account_movements').insert({
      company_id: companyId,
      client_id: selectedClientId,
      movement_type: 'Pago',
      payment_type: paymentType,
      description: paymentDescription.trim() || 'Pago recibido',
      debit: 0,
      credit: amount,
    })

    setSavingPayment(false)

    if (error) {
      setErrorMsg('Error al registrar el pago.')
      console.error(error)
      return
    }

    setSuccessMsg('Pago registrado correctamente.')
    setPaymentAmount('')
    setPaymentType('Pago parcial')
    setPaymentDescription('Pago recibido')
    setShowPaymentForm(false)

    await loadMovements(selectedClientId)
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
    const debit = movements.reduce((acc, item) => acc + Number(item.debit || 0), 0)
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

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
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
            <>
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-500">
                      Cuenta corriente de
                    </p>
                    <h2 className="text-2xl font-black text-slate-950">
                      {selectedClient.name}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-slate-400">
                      CUIT: {selectedClient.cuit}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(!showPaymentForm)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700"
                  >
                    <Plus size={18} />
                    Registrar pago
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  title="Total vendido"
                  value={`$${totals.debit.toLocaleString('es-AR')}`}
                  icon={ArrowUpCircle}
                  tone="blue"
                />

                <StatCard
                  title="Total pagado"
                  value={`$${totals.credit.toLocaleString('es-AR')}`}
                  icon={ArrowDownCircle}
                  tone="green"
                />

                <StatCard
                  title="Saldo pendiente"
                  value={`$${totals.balance.toLocaleString('es-AR')}`}
                  icon={Wallet}
                  tone={totals.balance > 0 ? 'red' : 'green'}
                />
              </div>

              {showPaymentForm && (
                <form
                  onSubmit={handleSavePayment}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="mb-4 text-lg font-black text-slate-950">
                    Registrar pago
                  </h3>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Monto
                      </span>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="Ej: 15000"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Tipo de pago
                      </span>
                      <select
                        value={paymentType}
                        onChange={(e) =>
                          setPaymentType(
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
                        Descripción
                      </span>
                      <input
                        value={paymentDescription}
                        onChange={(e) => setPaymentDescription(e.target.value)}
                        placeholder="Pago recibido"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </label>
                  </div>

                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPaymentForm(false)}
                      className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={savingPayment}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:opacity-70"
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
                    <table className="w-full min-w-[850px]">
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
                                <p className="mt-1 text-xs font-bold text-blue-500">
                                  Presupuesto:{' '}
                                  {movement.budgets.budget_code ||
                                    movement.budgets.budget_number}
                                </p>
                              )}
                            </td>

                            <td className="px-5 py-4 text-right text-base font-black text-red-600">
                              {Number(movement.debit || 0) > 0
                                ? `$${Number(movement.debit).toLocaleString(
                                    'es-AR'
                                  )}`
                                : '-'}
                            </td>

                            <td className="px-5 py-4 text-right text-base font-black text-green-600">
                              {Number(movement.credit || 0) > 0
                                ? `$${Number(movement.credit).toLocaleString(
                                    'es-AR'
                                  )}`
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles[tone]}`}
        >
          <Icon size={23} />
        </div>

        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <h2 className="text-2xl font-black text-slate-950">{value}</h2>
        </div>
      </div>
    </div>
  )
}