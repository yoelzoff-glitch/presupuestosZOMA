'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { getUserCompanyId } from '@/lib/getUserCompany'

type Order = {
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

export default function PedidosPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
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

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        clients (
          name,
          cuit
        )
      `)
      .eq('company_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error cargando pedidos:', error)
      alert('Error cargando pedidos')
      setLoading(false)
      return
    }

    setOrders(data || [])
    setLoading(false)
  }

  async function cancelOrder(order: Order) {
    if (order.status === 'confirmed') {
      alert('No podés anular un pedido que ya fue convertido a presupuesto.')
      return
    }

    const confirmCancel = confirm(
      `¿Seguro que querés anular el pedido ${order.order_code || order.order_number}?`
    )

    if (!confirmCancel || !companyId) return

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

    await loadData()
  }

  function getStatusLabel(status: string) {
    if (status === 'pending') return 'Pendiente'
    if (status === 'confirmed') return 'Confirmado'
    if (status === 'cancelled') return 'Anulado'
    return status
  }

  function getStatusClass(status: string) {
    if (status === 'pending') {
      return 'bg-amber-100 text-amber-700 border-amber-200'
    }

    if (status === 'confirmed') {
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    }

    if (status === 'cancelled') {
      return 'bg-red-100 text-red-700 border-red-200'
    }

    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  const filteredOrders = orders.filter((order) => {
    const searchText = search.toLowerCase()

    const matchesSearch =
      order.order_code?.toLowerCase().includes(searchText) ||
      String(order.order_number).includes(searchText) ||
      order.clients?.name?.toLowerCase().includes(searchText) ||
      order.clients?.cuit?.toLowerCase().includes(searchText)

    const matchesStatus =
      statusFilter === 'all' || order.status === statusFilter

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
              Tomá pedidos sin precio y convertilos en presupuesto cuando el cliente confirme.
            </p>
          </div>

          <Link
            href="/pedidos/nuevo"
            className="rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Nuevo pedido
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
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
            <p className="text-sm text-slate-500">Confirmados</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {orders.filter((o) => o.status === 'confirmed').length}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, CUIT o número de pedido..."
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
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">CUIT</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {order.order_code || `PED-${order.order_number}`}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {new Date(order.order_date).toLocaleDateString('es-AR')}
                      </td>

                      <td className="px-4 py-4 text-slate-900">
                        {order.clients?.name || 'Sin cliente'}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {order.clients?.cuit || '-'}
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
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/pedidos/${order.id}`}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Ver
                          </Link>

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