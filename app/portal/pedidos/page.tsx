'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  Loader2,
  Package,
  CalendarDays,
  XCircle,
  RefreshCw,
  ClipboardList,
  CheckCircle2,
  Clock3,
  FileText,
} from 'lucide-react'

type CustomerUser = {
  id: string
  company_id: string
  client_id: string | null
  name: string
  email: string
  active: boolean
}

type Order = {
  id: string
  company_id: string
  client_id: string
  order_number: number
  order_code: string | null
  order_date: string
  status: 'pending' | 'confirmed' | 'cancelled'
  source: 'manual' | 'portal' | string | null
  budget_id: string | null
  notes: string | null
  created_at: string
}

export default function MisPedidosPage() {
  const router = useRouter()

  const [customer, setCustomer] = useState<CustomerUser | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      router.push('/auth/login')
      return
    }

    const { data: customerData, error: customerError } = await supabase
      .from('customer_users')
      .select('id, company_id, client_id, name, email, active')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (customerError || !customerData) {
      setErrorMsg('No se encontró el cliente.')
      setLoading(false)
      return
    }

    if (!customerData.active) {
      setErrorMsg('Tu usuario está inactivo. Contactá al administrador.')
      setLoading(false)
      return
    }

    if (!customerData.client_id) {
      setErrorMsg(
        'Tu usuario todavía no tiene un cliente del sistema enlazado. Contactá al administrador.'
      )
      setLoading(false)
      return
    }

    setCustomer(customerData)

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        company_id,
        client_id,
        order_number,
        order_code,
        order_date,
        status,
        source,
        budget_id,
        notes,
        created_at
      `)
      .eq('company_id', customerData.company_id)
      .eq('client_id', customerData.client_id)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMsg('Error cargando pedidos.')
      setLoading(false)
      return
    }

    setOrders(data || [])
    setLoading(false)
  }

  function getOrderCode(order: Order) {
    return order.order_code || `PED-${String(order.order_number).padStart(6, '0')}`
  }

  async function createCancelledNotification({
    companyId,
    orderId,
    orderCode,
    customerName,
  }: {
    companyId: string
    orderId: string
    orderCode: string
    customerName: string
  }) {
    const res = await fetch('/api/notifications/order-cancelled', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        companyId,
        orderId,
        orderCode,
        customerName,
      }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      console.error('Error creando notificación de cancelación:', data)
      return false
    }

    return true
  }

  async function cancelOrder(order: Order) {
    if (!customer) return

    if (order.status !== 'pending') {
      alert('Solo podés cancelar pedidos pendientes.')
      return
    }

    const orderCode = getOrderCode(order)

    const confirmCancel = confirm(
      `¿Seguro que querés cancelar el pedido ${orderCode}?`
    )

    if (!confirmCancel) return

    setCancellingId(order.id)
    setErrorMsg('')
    setSuccessMsg('')

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('company_id', customer.company_id)
      .eq('client_id', customer.client_id)
      .eq('status', 'pending')

    if (error) {
      setErrorMsg('No se pudo cancelar el pedido.')
      setCancellingId(null)
      return
    }

    const notificationCreated = await createCancelledNotification({
      companyId: customer.company_id,
      orderId: order.id,
      orderCode,
      customerName: customer.name,
    })

    setOrders((prev) =>
      prev.map((item) =>
        item.id === order.id
          ? {
              ...item,
              status: 'cancelled',
            }
          : item
      )
    )

    setSuccessMsg(
      notificationCreated
        ? `Pedido ${orderCode} cancelado correctamente.`
        : `Pedido ${orderCode} cancelado correctamente, pero no se pudo notificar al administrador.`
    )

    setCancellingId(null)
  }

  function getStatusLabel(status: string) {
    if (status === 'pending') return 'Pendiente de revisión'
    if (status === 'confirmed') return 'Convertido en presupuesto'
    if (status === 'cancelled') return 'Cancelado'
    return status
  }

  function getStatusClass(status: string) {
    if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200'
    if (status === 'confirmed') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (status === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  const totalOrders = orders.length

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === 'pending').length,
    [orders]
  )

  const confirmedOrders = useMemo(
    () => orders.filter((order) => order.status === 'confirmed').length,
    [orders]
  )

  const cancelledOrders = useMemo(
    () => orders.filter((order) => order.status === 'cancelled').length,
    [orders]
  )

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-200">
              <ClipboardList size={14} />
              Portal cliente
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Mis pedidos
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Consultá los pedidos enviados y cancelá los que todavía estén pendientes.
            </p>
          </div>

          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Pedidos realizados"
          value={totalOrders}
          icon={Package}
          tone="blue"
        />

        <SummaryCard
          title="Pendientes"
          value={pendingOrders}
          icon={Clock3}
          tone="amber"
        />

        <SummaryCard
          title="Presupuestados"
          value={confirmedOrders}
          icon={CheckCircle2}
          tone="green"
        />

        <SummaryCard
          title="Cancelados"
          value={cancelledOrders}
          icon={XCircle}
          tone="slate"
        />
      </section>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-14 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
            <Loader2 size={28} className="animate-spin" />
          </div>

          <h3 className="text-lg font-black text-slate-950">
            Cargando pedidos
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Estamos buscando tus pedidos realizados.
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-100 blur-3xl" />

          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
              <Package size={30} />
            </div>

            <h3 className="text-xl font-black text-slate-950">
              Todavía no hiciste pedidos
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Cuando envíes un pedido desde la lista de precios, lo vas a ver acá.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="group overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
                    <Package size={22} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-slate-950">
                        {getOrderCode(order)}
                      </h2>

                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getStatusClass(
                          order.status
                        )}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={15} />
                        {new Date(order.created_at).toLocaleDateString('es-AR')}
                      </span>

                      {order.budget_id && (
                        <span className="inline-flex items-center gap-1 text-blue-600">
                          <FileText size={15} />
                          Presupuesto generado
                        </span>
                      )}
                    </div>

                    {order.notes && (
                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        {order.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
                  {order.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => cancelOrder(order)}
                      disabled={cancellingId === order.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cancellingId === order.id ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <XCircle size={17} />
                      )}

                      {cancellingId === order.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string
  value: number
  icon: any
  tone: 'blue' | 'amber' | 'green' | 'slate'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles[tone]}`}
        >
          <Icon size={23} />
        </div>

        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <p className="text-2xl font-black text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  )
}