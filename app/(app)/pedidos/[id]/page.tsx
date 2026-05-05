'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
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
  clients?: {
    name: string
    cuit: string
    address: string | null
  } | null
}

type OrderItem = {
  id: string
  company_id: string
  order_id: string
  product_id: string | null
  product_code: string | null
  product_name: string
  category: string | null
  quantity: number
}

type Product = {
  id: string
  internal_code: string | null
  name: string
  category: string | null
  cost_price: number
}

export default function PedidoDetallePage() {
  const params = useParams()
  const router = useRouter()

  const orderId = params.id as string

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)

  useEffect(() => {
    loadOrder()
  }, [])

  async function loadOrder() {
    setLoading(true)

    const id = await getUserCompanyId()

    if (!id) {
      alert('No se encontró la empresa del usuario.')
      setLoading(false)
      return
    }

    setCompanyId(id)

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        clients (
          name,
          cuit,
          address
        )
      `)
      .eq('company_id', id)
      .eq('id', orderId)
      .single()

    if (orderError) {
      console.error('Error cargando pedido:', orderError)
      alert('No se pudo cargar el pedido.')
      setLoading(false)
      return
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('company_id', id)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (itemsError) {
      console.error('Error cargando productos del pedido:', itemsError)
      alert('No se pudieron cargar los productos del pedido.')
      setLoading(false)
      return
    }

    setOrder(orderData as Order)
    setItems((itemsData || []) as OrderItem[])
    setLoading(false)
  }

  async function getNextBudgetNumber(id: string) {
    const { data, error } = await supabase
      .from('budgets')
      .select('budget_number')
      .eq('company_id', id)
      .order('budget_number', { ascending: false })
      .limit(1)

    if (error) throw error

    const lastNumber = data?.[0]?.budget_number || 0
    return lastNumber + 1
  }

  async function convertToBudget() {
    if (!companyId || !order) return

    if (order.status !== 'pending') {
      alert('Este pedido ya no está pendiente.')
      return
    }

    if (items.length === 0) {
      alert('El pedido no tiene productos.')
      return
    }

    const confirmConvert = confirm(
      '¿Querés convertir este pedido en presupuesto? Se tomarán los precios actuales de productos.'
    )

    if (!confirmConvert) return

    setConverting(true)

    try {
      const productIds = items
        .map((item) => item.product_id)
        .filter(Boolean) as string[]

      let products: Product[] = []

      if (productIds.length > 0) {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, internal_code, name, category, cost_price')
          .eq('company_id', companyId)
          .in('id', productIds)

        if (productsError) throw productsError

        products = (productsData || []) as Product[]
      }

      const budgetItems = items.map((item) => {
        const product = products.find((p) => p.id === item.product_id)

        const unitPrice = product ? Number(product.cost_price || 0) : 0
        const quantity = Number(item.quantity || 0)

        return {
          company_id: companyId,
          product_id: item.product_id,
          product_code: product?.internal_code || item.product_code,
          product_name: product?.name || item.product_name,
          category: product?.category || item.category,
          quantity,
          unit_price: unitPrice,
        }
      })

      const totalAmount = budgetItems.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0
      )

      const nextBudgetNumber = await getNextBudgetNumber(companyId)

      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          company_id: companyId,
          client_id: order.client_id,
          budget_number: nextBudgetNumber,
          total_amount: totalAmount,
          status: 'issued',
        })
        .select('id')
        .single()

      if (budgetError) throw budgetError

      const budgetId = budgetData.id

      const itemsToInsert = budgetItems.map((item) => ({
        ...item,
        budget_id: budgetId,
      }))

      const { error: budgetItemsError } = await supabase
        .from('budget_items')
        .insert(itemsToInsert)

      if (budgetItemsError) throw budgetItemsError

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          budget_id: budgetId,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)
        .eq('id', order.id)

      if (orderUpdateError) throw orderUpdateError

      router.push(`/presupuestos/${budgetId}`)
    } catch (error) {
      console.error('Error convirtiendo pedido a presupuesto:', error)

      const message =
        error instanceof Error ? error.message : JSON.stringify(error)

      alert(message || 'No se pudo convertir el pedido en presupuesto.')
    } finally {
      setConverting(false)
    }
  }

  async function cancelOrder() {
    if (!companyId || !order) return

    if (order.status === 'confirmed') {
      alert('No podés anular un pedido ya convertido a presupuesto.')
      return
    }

    const confirmCancel = confirm('¿Seguro que querés anular este pedido?')

    if (!confirmCancel) return

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('id', order.id)

    if (error) {
      console.error('Error anulando pedido:', error)
      alert('No se pudo anular el pedido.')
      return
    }

    await loadOrder()
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('es-AR')
  }

  function getStatusLabel(status: string) {
    if (status === 'pending') return 'Pendiente'
    if (status === 'confirmed') return 'Confirmado'
    if (status === 'cancelled') return 'Anulado'
    return status
  }

  function getStatusClass(status: string) {
    if (status === 'pending') return 'bg-amber-100 text-amber-700 border-amber-200'
    if (status === 'confirmed') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (status === 'cancelled') return 'bg-red-100 text-red-700 border-red-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-8 text-slate-500 shadow-sm">
          Cargando pedido...
        </div>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-8 text-slate-500 shadow-sm">
          Pedido no encontrado.
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-slate-950 p-6 text-white shadow-lg md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-300">Detalle de pedido</p>
            <h1 className="mt-1 text-3xl font-bold">
              {order.order_code || `PED-${order.order_number}`}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Pedido tomado sin valores. Al confirmar, se genera un presupuesto con precios actuales.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/pedidos"
              className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Volver
            </Link>

            {order.status === 'pending' && (
              <>
                <button
                  type="button"
                  onClick={cancelOrder}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
                >
                  Anular
                </button>

                <button
                  type="button"
                  onClick={convertToBudget}
                  disabled={converting}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {converting ? 'Convirtiendo...' : 'Convertir a presupuesto'}
                </button>
              </>
            )}

            {order.status === 'confirmed' && order.budget_id && (
              <Link
                href={`/presupuestos/${order.budget_id}`}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Ver presupuesto
              </Link>
            )}
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Estado</p>
            <span
              className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                order.status
              )}`}
            >
              {getStatusLabel(order.status)}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Fecha</p>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {formatDate(order.order_date)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Cliente</p>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {order.clients?.name || 'Sin cliente'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Productos</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{items.length}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Datos del cliente</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">Nombre</p>
              <p className="mt-1 font-semibold text-slate-900">
                {order.clients?.name || '-'}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">CUIT</p>
              <p className="mt-1 font-semibold text-slate-900">
                {order.clients?.cuit || '-'}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Dirección</p>
              <p className="mt-1 font-semibold text-slate-900">
                {order.clients?.address || '-'}
              </p>
            </div>
          </div>

          {order.notes && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Notas</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{order.notes}</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Productos solicitados</h2>
            <p className="text-sm text-slate-500">Sin precios</p>
          </div>

          <div className="mt-4 overflow-x-auto">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Este pedido no tiene productos cargados.
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-4 py-3 font-semibold">Código</th>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold">Categoría</th>
                    <th className="px-4 py-3 font-semibold">Cantidad</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-4 py-4 text-slate-600">
                        {item.product_code || '-'}
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {item.product_name}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {item.category || '-'}
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {item.quantity}
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