'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Loader2,
  Package,
  CalendarDays,
  CircleDollarSign,
  XCircle,
  RefreshCw,
  ClipboardList,
  AlertCircle,
} from 'lucide-react'

type Order = {
  id: string
  status: string
  total_amount: number
  notes: string | null
  created_at: string
}

export default function MisPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoading(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      setErrorMsg('No estás logueado.')
      setLoading(false)
      return
    }

    const { data: customer, error: customerError } = await supabase
      .from('customer_users')
      .select('id')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (customerError || !customer) {
      setErrorMsg('No se encontró el cliente.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('customer_orders')
      .select('*')
      .eq('customer_user_id', customer.id)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMsg('Error cargando pedidos.')
      setLoading(false)
      return
    }

    setOrders(data || [])
    setLoading(false)
  }

  async function cancelOrder(order: Order) {
    if (order.status !== 'pending') {
      alert('Solo podés cancelar pedidos pendientes.')
      return
    }

    const confirmCancel = confirm('¿Seguro que querés cancelar este pedido?')

    if (!confirmCancel) return

    setCancellingId(order.id)
    setErrorMsg('')

    const { error } = await supabase
      .from('customer_orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('status', 'pending')

    if (error) {
      setErrorMsg('No se pudo cancelar el pedido.')
      setCancellingId(null)
      return
    }

    await loadOrders()
    setCancellingId(null)
  }

  function getStatusLabel(status: string) {
    if (status === 'pending') return 'Pendiente'
    if (status === 'approved') return 'Aprobado'
    if (status === 'rejected') return 'Rechazado'
    if (status === 'delivered') return 'Entregado'
    if (status === 'cancelled') return 'Cancelado'
    return status
  }

  function getStatusClass(status: string) {
    if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200'
    if (status === 'approved') return 'bg-blue-50 text-blue-700 border-blue-200'
    if (status === 'delivered') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (status === 'rejected') return 'bg-red-50 text-red-700 border-red-200'
    if (status === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  const totalOrders = orders.length
  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === 'pending').length,
    [orders]
  )
  const totalAmount = useMemo(
    () =>
      orders
        .filter((order) => order.status !== 'cancelled' && order.status !== 'rejected')
        .reduce((acc, order) => acc + Number(order.total_amount || 0), 0),
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
              Consultá el estado de tus pedidos y cancelá los que todavía estén pendientes.
            </p>
          </div>

          <button
            onClick={loadOrders}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Pedidos realizados"
          value={totalOrders}
          icon={Package}
          tone="blue"
        />

        <SummaryCard
          title="Pendientes"
          value={pendingOrders}
          icon={AlertCircle}
          tone="amber"
        />

        <SummaryCard
          title="Total activo"
          value={formatCurrency(totalAmount)}
          icon={CircleDollarSign}
          tone="green"
        />
      </section>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {errorMsg}
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
          {orders.map((order, index) => (
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
                        Pedido #{String(orders.length - index).padStart(3, '0')}
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

                      <span className="inline-flex items-center gap-1 font-black text-blue-700">
                        <CircleDollarSign size={15} />
                        {formatCurrency(Number(order.total_amount || 0))}
                      </span>
                    </div>

                    {order.notes && (
                      <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                        {order.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 justify-end">
                  {order.status === 'pending' ? (
                    <button
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
                  ) : (
                    <span className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-400">
                      Sin acciones
                    </span>
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
  value: number | string
  icon: typeof Package
  tone: 'blue' | 'green' | 'amber'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles[tone]}`}
        >
          <Icon size={23} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-500">{title}</p>
          <h3 className="truncate text-2xl font-black text-slate-950">
            {value}
          </h3>
        </div>
      </div>
    </div>
  )
}

function formatCurrency(value: number) {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
  })
}