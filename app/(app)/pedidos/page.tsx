'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  CalendarDays,
  User,
  FileText,
  XCircle,
  Clock3,
  CheckCircle2,
  Package,
  Globe2,
  UserRoundCog,
  Filter,
  UserCheck,
} from 'lucide-react'

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
  total_amount: number | null
  clients?: {
    name: string
    cuit: string
  } | null
}

type SellerProfile = {
  id: string
  full_name: string
}

export default function PedidosPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [sellers, setSellers] = useState<SellerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sellerFilter, setSellerFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'confirmed' | 'cancelled'
  >('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'portal' | 'manual'>(
    'all'
  )
  const [errorMsg, setErrorMsg] = useState('')
  const [myId, setMyId] = useState<string | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    setLoading(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setErrorMsg('No se pudo autenticar al usuario.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id, role, id')
      .eq('id', userData.user.id)
      .single()

    if (!profile?.company_id) {
      setErrorMsg('No se encontró el perfil del usuario.')
      setLoading(false)
      return
    }

    setCompanyId(profile.company_id)
    setMyId(profile.id)

    // Cargar vendedores para el filtro
    const { data: sellersData } = await supabase
      .from('users_profiles')
      .select('id, full_name')
      .eq('company_id', profile.company_id)
      .order('full_name')

    setSellers(sellersData || [])

    // Filtro inicial
    if (profile.role === 'vendedor') {
      setSellerFilter(profile.id)
    }

    await fetchOrders(profile.company_id)
  }

  async function fetchOrders(cid: string) {
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
        created_at,
        total_amount,
        seller_id,
        clients (
          name,
          cuit
        )
      `)
      .eq('company_id', cid)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMsg('Error cargando pedidos.')
    } else {
      const normalized = (data || []).map((item: any) => ({
        ...item,
        clients: Array.isArray(item.clients)
          ? item.clients[0] || null
          : item.clients || null,
      }))
      setOrders(normalized)
    }
    setLoading(false)
  }

  async function refreshOrders() {
    if (!companyId) return
    setRefreshing(true)
    await fetchOrders(companyId)
    setRefreshing(false)
  }

  async function cancelOrder(order: Order) {
    if (!companyId) return

    if (order.status === 'confirmed') {
      alert('No podés anular un pedido que ya fue convertido a presupuesto.')
      return
    }

    const confirmCancel = confirm(
      `¿Seguro que querés anular el pedido ${
        order.order_code || `PED-${order.order_number}`
      }?`
    )

    if (!confirmCancel) return

    setCancellingId(order.id)

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('company_id', companyId)
      .eq('status', 'pending')

    if (error) {
      alert('No se pudo anular el pedido.')
    } else {
      await fetchOrders(companyId)
    }
    setCancellingId(null)
  }

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase().trim()

    return orders.filter((order: any) => {
      const code = order.order_code || `PED-${order.order_number}`

      const matchesSearch =
        !q ||
        code.toLowerCase().includes(q) ||
        order.clients?.name?.toLowerCase().includes(q) ||
        order.clients?.cuit?.toLowerCase().includes(q) ||
        order.notes?.toLowerCase().includes(q) ||
        order.source?.toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === 'all' || order.status === statusFilter

      const orderSource = order.source || 'manual'
      const matchesSource =
        sourceFilter === 'all' || orderSource === sourceFilter

      const matchesSeller = sellerFilter === 'all' || order.seller_id === sellerFilter

      return matchesSearch && matchesStatus && matchesSource && matchesSeller
    })
  }, [orders, search, statusFilter, sourceFilter, sellerFilter])

  const pendingCount = orders.filter((order) => order.status === 'pending').length
  const confirmedCount = orders.filter(
    (order) => order.status === 'confirmed'
  ).length
  const cancelledCount = orders.filter(
    (order) => order.status === 'cancelled'
  ).length
  const portalCount = orders.filter((order) => order.source === 'portal').length

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-200">
              <ClipboardList size={14} />
              Gestión comercial
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Pedidos
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Gestión centralizada de pedidos. Ahora podés alternar entre tus pedidos y los de tus compañeros para mayor colaboración.
            </p>
          </div>

          <Link
            href="/pedidos/nuevo"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
          >
            <Plus size={18} />
            Nuevo pedido
          </Link>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total pedidos"
          value={orders.length}
          icon={ClipboardList}
          loading={loading}
          tone="blue"
        />

        <StatCard
          title="Pendientes"
          value={pendingCount}
          icon={Clock3}
          loading={loading}
          tone="amber"
        />

        <StatCard
          title="Convertidos"
          value={confirmedCount}
          icon={CheckCircle2}
          loading={loading}
          tone="green"
        />

        <StatCard
          title="Anulados"
          value={cancelledCount}
          icon={XCircle}
          loading={loading}
          tone="red"
        />

        <StatCard
          title="Desde portal"
          value={portalCount}
          icon={Globe2}
          loading={loading}
          tone="blue"
        />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-slate-200 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Listado de pedidos
              </h2>

              <p className="text-sm text-slate-500">
                Filtrá por estado, origen o vendedor asignado.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:justify-end">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar pedido..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:w-64"
                />
              </div>

              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">Todos los vendedores</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.id === myId ? '(Yo)' : ''}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="confirmed">Convertidos</option>
                <option value="cancelled">Anulados</option>
              </select>

              <button
                type="button"
                onClick={refreshOrders}
                disabled={loading || refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={loading || refreshing ? 'animate-spin' : ''}
                />
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredOrders.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto pb-4 custom-scrollbar">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead align="right">Total</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead align="right">Acciones</TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className={`transition ${
                        order.status === 'cancelled'
                          ? 'bg-red-50/40 opacity-75'
                          : 'hover:bg-blue-50/40'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <OrderIdentity order={order} />
                      </td>

                      <td className="px-5 py-4">
                        <SourceBadge source={order.source} />
                      </td>

                      <td className="px-5 py-4">
                        <DateBadge date={order.created_at || order.order_date} />
                      </td>

                      <td className="px-5 py-4">
                        <ClientName order={order} />
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-600">
                          {order.clients?.cuit || '-'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={order.status} />
                      </td>
                      
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-black text-slate-900">
                          ${(order.total_amount || 0).toLocaleString('es-AR')}
                        </span>
                      </td>

                      <td className="px-5 py-4 max-w-[200px]">
                        <p className="truncate text-sm font-semibold text-slate-500" title={order.notes || ''}>
                          {order.notes || '-'}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <OrderActions
                          order={order}
                          cancelling={cancellingId === order.id}
                          onCancel={() => cancelOrder(order)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {filteredOrders.map((order) => (
                <OrderMobileCard
                  key={order.id}
                  order={order}
                  cancelling={cancellingId === order.id}
                  onCancel={() => cancelOrder(order)}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function OrderMobileCard({
  order,
  cancelling,
  onCancel,
}: {
  order: Order
  cancelling: boolean
  onCancel: () => void
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <OrderIdentity order={order} />
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-4 space-y-3">
        <SourceBadge source={order.source} />
        <ClientName order={order} />

        <div className="flex items-center justify-between rounded-2xl bg-blue-50 p-3">
          <span className="text-xs font-bold text-blue-600 uppercase">Total</span>
          <span className="text-base font-black text-blue-700">
            ${(order.total_amount || 0).toLocaleString('es-AR')}
          </span>
        </div>

        <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">
          {order.notes || 'Sin notas'}
        </p>
      </div>

      <div className="mt-4">
        <OrderActions order={order} cancelling={cancelling} onCancel={onCancel} mobile />
      </div>
    </article>
  )
}

function OrderIdentity({ order }: { order: Order }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
        <Package size={20} />
      </div>

      <div className="min-w-0">
        <p className="truncate font-black text-slate-950">
          {order.order_code || `PED-${order.order_number}`}
        </p>

        <p className="text-xs font-semibold text-slate-400">
          Pedido comercial
        </p>
      </div>
    </div>
  )
}

function SourceBadge({ source }: { source: Order['source'] }) {
  const normalizedSource = source || 'manual'

  if (normalizedSource === 'portal') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
        <Globe2 size={14} />
        Portal
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
      <UserRoundCog size={14} />
      Manual
    </span>
  )
}

function ClientName({ order }: { order: Order }) {
  return (
    <div className="flex items-center gap-2">
      <User size={16} className="shrink-0 text-slate-400" />
      <span className="font-bold text-slate-800">
        {order.clients?.name || 'Sin cliente'}
      </span>
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

function StatusBadge({ status }: { status: Order['status'] }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
        <Clock3 size={14} />
        Pendiente
      </span>
    )
  }

  if (status === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
        <CheckCircle2 size={14} />
        Convertido
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
      <XCircle size={14} />
      Anulado
    </span>
  )
}

function OrderActions({
  order,
  cancelling,
  onCancel,
  mobile = false,
}: {
  order: Order
  cancelling: boolean
  onCancel: () => void
  mobile?: boolean
}) {
  return (
    <div className={`flex gap-2 ${mobile ? 'flex-col' : 'justify-end'}`}>
      <Link
        href={`/pedidos/${order.id}`}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      >
        <FileText size={15} />
        Ver
      </Link>

      {order.status === 'pending' && (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cancelling ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <XCircle size={15} />
          )}
          Anular
        </button>
      )}

      {order.status === 'confirmed' && order.budget_id && (
        <Link
          href={`/presupuestos/${order.budget_id}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
        >
          <FileText size={15} />
          Presupuesto
        </Link>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  tone,
}: {
  title: string
  value: number
  icon: any
  loading: boolean
  tone: 'blue' | 'amber' | 'green' | 'red'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  }

  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles[tone]}`}
        >
          <Icon size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-500">{title}</p>

          <h2 className="truncate text-2xl font-black text-slate-950">
            {loading ? '...' : value}
          </h2>
        </div>
      </div>
    </div>
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

      <h3 className="text-lg font-black text-slate-900">Cargando pedidos</h3>

      <p className="mt-1 text-sm text-slate-500">
        Estamos consultando los pedidos registrados.
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
        <ClipboardList size={26} />
      </div>

      <h3 className="text-lg font-black text-slate-900">
        No hay pedidos para mostrar
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Probá cambiando el filtro o los términos de búsqueda.
      </p>

      <Link
        href="/pedidos/nuevo"
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
      >
        <Plus size={18} />
        Nuevo pedido
      </Link>
    </div>
  )
}