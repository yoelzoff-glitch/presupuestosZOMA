'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { getUserCompanyId } from '@/lib/getUserCompany'

type ManualOrder = {
  id: string
  company_id: string
  client_id: string
  order_number: number
  order_code: string | null
  order_date: string
  status: 'pending' | 'confirmed' | 'cancelled'
  budget_id: string | null
  notes: string | null
  created_at: string
  clients?: {
    name: string
    cuit: string
  } | null
}

type PortalOrder = {
  id: string
  company_id: string
  customer_user_id: string
  status: 'pending' | 'approved' | 'rejected' | 'delivered' | 'cancelled'
  notes: string | null
  total_amount: number
  created_at: string
  updated_at: string
  customer_users?: {
    name: string
    email: string
  } | null
}

type UnifiedOrder = {
  id: string
  source: 'manual' | 'portal'
  code: string
  date: string
  clientName: string
  clientExtra: string
  status: string
  totalAmount: number | null
  notes: string | null
  raw: ManualOrder | PortalOrder
}

export default function PedidosPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const id = await getUserCompanyId()

    if (!id) {
      setLoading(false)
      return
    }

    setCompanyId(id)

    const [manualRes, portalRes] = await Promise.all([
      supabase
        .from('orders')
        .select(`
          *,
          clients (
            name,
            cuit
          )
        `)
        .eq('company_id', id)
        .order('created_at', { ascending: false }),

      supabase
        .from('customer_orders')
        .select(`
          *,
          customer_users (
            name,
            email
          )
        `)
        .eq('company_id', id)
        .order('created_at', { ascending: false }),
    ])

    if (manualRes.error) {
      console.error('Error cargando pedidos manuales:', manualRes.error)
      alert('Error cargando pedidos manuales')
      setLoading(false)
      return
    }

    if (portalRes.error) {
      console.error('Error cargando pedidos del portal:', portalRes.error)
      alert('Error cargando pedidos del portal')
      setLoading(false)
      return
    }

    const manualOrders: UnifiedOrder[] = (manualRes.data || []).map(
      (order: ManualOrder) => ({
        id: order.id,
        source: 'manual',
        code: order.order_code || `PED-${order.order_number}`,
        date: order.order_date,
        clientName: order.clients?.name || 'Sin cliente',
        clientExtra: order.clients?.cuit || '-',
        status: order.status,
        totalAmount: null,
        notes: order.notes,
        raw: order,
      })
    )

    const portalOrders: UnifiedOrder[] = (portalRes.data || []).map(
      (order: PortalOrder, index: number) => ({
        id: order.id,
        source: 'portal',
        code: `WEB-${String(index + 1).padStart(4, '0')}`,
        date: order.created_at,
        clientName: order.customer_users?.name || 'Cliente portal',
        clientExtra: order.customer_users?.email || '-',
        status: order.status,
        totalAmount: Number(order.total_amount || 0),
        notes: order.notes,
        raw: order,
      })
    )

    const allOrders = [...manualOrders, ...portalOrders].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    setOrders(allOrders)
    setLoading(false)
  }

  async function cancelOrder(order: UnifiedOrder) {
    const confirmCancel = confirm(`¿Seguro que querés anular el pedido ${order.code}?`)

    if (!confirmCancel || !companyId) return

    if (order.source === 'manual') {
      if (order.status === 'confirmed') {
        alert('No podés anular un pedido que ya fue convertido a presupuesto.')
        return
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('company_id', companyId)

      if (error) {
        console.error('Error anulando pedido:', error)
        alert('No se pudo anular el pedido')
        return
      }
    }

    if (order.source === 'portal') {
      const { error } = await supabase
        .from('customer_orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('company_id', companyId)

      if (error) {
        console.error('Error anulando pedido portal:', error)
        alert('No se pudo anular el pedido del portal')
        return
      }
    }

    await loadData()
  }

  async function updatePortalOrderStatus(
    order: UnifiedOrder,
    status: 'approved' | 'rejected' | 'delivered'
  ) {
    if (!companyId || order.source !== 'portal') return

    const { error } = await supabase
      .from('customer_orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Error actualizando pedido portal:', error)
      alert('No se pudo actualizar el estado del pedido')
      return
    }

    await loadData()
  }

  function getStatusLabel(status: string) {
    if (status === 'pending') return 'Pendiente'
    if (status === 'confirmed') return 'Confirmado'
    if (status === 'cancelled') return 'Anulado'
    if (status === 'approved') return 'Aprobado'
    if (status === 'rejected') return 'Rechazado'
    if (status === 'delivered') return 'Entregado'
    return status
  }

  function getStatusClass(status: string) {
    if (status === 'pending') return 'bg-amber-100 text-amber-700 border-amber-200'
    if (status === 'confirmed') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (status === 'approved') return 'bg-blue-100 text-blue-700 border-blue-200'
    if (status === 'delivered') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (status === 'rejected') return 'bg-red-100 text-red-700 border-red-200'
    if (status === 'cancelled') return 'bg-red-100 text-red-700 border-red-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  const filteredOrders = orders.filter((order) => {
    const searchText = search.toLowerCase()

    const matchesSearch =
      order.code.toLowerCase().includes(searchText) ||
      order.clientName.toLowerCase().includes(searchText) ||
      order.clientExtra.toLowerCase().includes(searchText) ||
      order.source.toLowerCase().includes(searchText)

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter

    return matchesSearch && matchesStatus
  })

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-slate-950 p-6 text-white shadow-lg md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-300">Gestión comercial</p>
            <h1 className="mt-1 text-3xl font-bold">Pedidos</h1>
            <p className="mt-2 text-sm text-slate-300">
              Pedidos manuales y pedidos recibidos desde el portal de clientes.
            </p>
          </div>

          <Link
            href="/pedidos/nuevo"
            className="rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Nuevo pedido
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total pedidos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{orders.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Pendientes</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">
              {orders.filter((o) => o.status === 'pending').length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Portal</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">
              {orders.filter((o) => o.source === 'portal').length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Confirmados/Aprobados</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {
                orders.filter(
                  (o) => o.status === 'confirmed' || o.status === 'approved'
                ).length
              }
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, usuario, CUIT o número de pedido..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:max-w-md"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="confirmed">Confirmados</option>
              <option value="approved">Aprobados</option>
              <option value="delivered">Entregados</option>
              <option value="rejected">Rechazados</option>
              <option value="cancelled">Anulados</option>
            </select>
          </div>

          <div className="mt-5 overflow-x-auto">
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-500">
                Cargando pedidos...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                No hay pedidos para mostrar.
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-4 py-3 font-semibold">Pedido</th>
                    <th className="px-4 py-3 font-semibold">Origen</th>
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Dato</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={`${order.source}-${order.id}`}
                      className="border-b border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {order.code}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            order.source === 'portal'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {order.source === 'portal' ? 'Portal' : 'Manual'}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {new Date(order.date).toLocaleDateString('es-AR')}
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {order.clientName}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {order.clientExtra}
                      </td>

                      <td className="px-4 py-4 text-right font-bold text-slate-900">
                        {order.totalAmount === null
                          ? '-'
                          : formatCurrency(order.totalAmount)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          {order.source === 'manual' && (
                            <Link
                              href={`/pedidos/${order.id}`}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Ver
                            </Link>
                          )}

                          {order.source === 'portal' && order.status === 'pending' && (
                            <>
                              <button
                                onClick={() =>
                                  updatePortalOrderStatus(order, 'approved')
                                }
                                className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                              >
                                Aprobar
                              </button>

                              <button
                                onClick={() =>
                                  updatePortalOrderStatus(order, 'rejected')
                                }
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                              >
                                Rechazar
                              </button>
                            </>
                          )}

                          {order.source === 'portal' && order.status === 'approved' && (
                            <button
                              onClick={() =>
                                updatePortalOrderStatus(order, 'delivered')
                              }
                              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
                            >
                              Entregar
                            </button>
                          )}

                          {order.status === 'pending' && (
                            <button
                              onClick={() => cancelOrder(order)}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Anular
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
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