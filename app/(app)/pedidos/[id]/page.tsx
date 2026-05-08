'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getUserCompanyId } from '@/lib/getUserCompany'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileText,
  Hash,
  Loader2,
  MapPin,
  Package,
  ReceiptText,
  Tag,
  User,
  XCircle,
  Wallet,
} from 'lucide-react'

type OrderStatus = 'pending' | 'confirmed' | 'cancelled' | string

type Order = {
  id: string
  company_id: string
  client_id: string
  order_number: number
  order_code: string | null
  order_date: string | null
  status: OrderStatus
  budget_id: string | null
  source: string | null
  total_amount: number | null
  notes: string | null
  created_at: string | null
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
  unit_price: number | null
}

type Product = {
  id: string
  internal_code: string | null
  name: string
  category: string | null
  cost_price: number | null
}

type BudgetItemPreview = {
  company_id: string
  product_id: string | null
  product_code: string | null
  product_name: string
  category: string | null
  quantity: number
  unit_price: number
}

export default function PedidoDetallePage() {
  const params = useParams()
  const router = useRouter()

  const orderId = params.id as string

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [sendingToAccount, setSendingToAccount] = useState(false)
  const [alreadyInAccount, setAlreadyInAccount] = useState(false)

  useEffect(() => {
    if (orderId) {
      loadOrder()
    }
  }, [orderId])

  async function loadOrder() {
    setLoading(true)

    const currentCompanyId = await getUserCompanyId()

    if (!currentCompanyId) {
      toast.error('No se encontró la empresa del usuario.')
      setLoading(false)
      return
    }

    setCompanyId(currentCompanyId)

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        company_id,
        client_id,
        order_number,
        order_code,
        order_date,
        status,
        budget_id,
        source,
        total_amount,
        notes,
        created_at,
        clients (
          name,
          cuit,
          address
        )
      `)
      .eq('company_id', currentCompanyId)
      .eq('id', orderId)
      .single()

    if (orderError || !orderData) {
      console.error('Error cargando pedido:', orderError)
      toast.error('No se pudo cargar el pedido.')
      setLoading(false)
      return
    }

    const normalizedOrder = {
      ...orderData,
      clients: Array.isArray(orderData.clients)
        ? orderData.clients[0] || null
        : orderData.clients || null,
    } as Order

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        id,
        company_id,
        order_id,
        product_id,
        product_code,
        product_name,
        category,
        quantity,
        unit_price
      `)
      .eq('company_id', currentCompanyId)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (itemsError) {
      console.error('Error cargando productos del pedido:', itemsError)
      toast.error('No se pudieron cargar los productos del pedido.')
      setLoading(false)
      return
    }

    const loadedItems = (itemsData || []) as OrderItem[]

    const productIds = loadedItems
      .map((item) => item.product_id)
      .filter(Boolean) as string[]

    let productsData: Product[] = []

    if (productIds.length > 0) {
      const { data, error } = await supabase
        .from('products')
        .select('id, internal_code, name, category, cost_price')
        .eq('company_id', currentCompanyId)
        .in('id', productIds)

      if (error) {
        console.error('Error cargando precios actuales:', error)
        toast.error('No se pudieron cargar los precios actuales.')
      } else {
        productsData = (data || []) as Product[]
      }
    }

    const initialPrices: Record<string, string> = {}

    // If order has budget, fetch original prices from budget_items
    if (normalizedOrder.budget_id) {
      const { data: bItemsData } = await supabase
        .from('budget_items')
        .select('product_code, unit_price')
        .eq('budget_id', normalizedOrder.budget_id)
      
      if (bItemsData) {
        loadedItems.forEach((item) => {
          const bItem = bItemsData.find(bi => bi.product_code === item.product_code)
          if (bItem) {
            initialPrices[item.id] = String(bItem.unit_price)
          } else {
            const product = productsData.find((p) => p.id === item.product_id)
            initialPrices[item.id] = String(product?.cost_price || 0)
          }
        })
      }
    } else {
      loadedItems.forEach((item) => {
        // Priorizar el precio guardado en el ítem (portal)
        if (item.unit_price !== null && item.unit_price !== undefined) {
          initialPrices[item.id] = String(item.unit_price)
        } else {
          const product = productsData.find((p) => p.id === item.product_id)
          const price = Number(product?.cost_price || 0)
          initialPrices[item.id] = String(price)
        }
      })
    }

    setOrder(normalizedOrder)
    setItems(loadedItems)
    setProducts(productsData)
    setItemPrices(initialPrices)

    // Check if already in account current
    if (normalizedOrder.budget_id) {
      const { data: movement } = await supabase
        .from('account_movements')
        .select('id')
        .eq('budget_id', normalizedOrder.budget_id)
        .eq('movement_type', 'Venta')
        .maybeSingle()
      
      if (movement) setAlreadyInAccount(true)
    }

    setLoading(false)
  }

  async function getNextBudgetNumber(currentCompanyId: string) {
    const { data, error } = await supabase
      .from('budgets')
      .select('budget_number')
      .eq('company_id', currentCompanyId)
      .order('budget_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    return (data?.budget_number ?? 1949) + 1
  }

  function getItemUnitPrice(item: OrderItem) {
    const rawPrice = itemPrices[item.id]
    const parsedPrice = Number(rawPrice)

    if (Number.isNaN(parsedPrice)) return 0

    return parsedPrice
  }

  function buildBudgetItems(): BudgetItemPreview[] {
    if (!companyId) return []

    return items.map((item) => {
      const product = products.find((p) => p.id === item.product_id)

      return {
        company_id: companyId,
        product_id: item.product_id,
        product_code: product?.internal_code || item.product_code,
        product_name: product?.name || item.product_name,
        category: product?.category || item.category,
        quantity: Number(item.quantity || 0),
        unit_price: getItemUnitPrice(item),
      }
    })
  }

  function updateItemPrice(itemId: string, value: string) {
    setItemPrices((prev) => ({
      ...prev,
      [itemId]: value,
    }))
  }

  const budgetItemsPreview = buildBudgetItems()

  const totalAmount = budgetItemsPreview.reduce((acc, item) => {
    return acc + Number(item.quantity || 0) * Number(item.unit_price || 0)
  }, 0)

  const productsWithoutPrice = budgetItemsPreview.filter(
    (item) => Number(item.unit_price || 0) <= 0
  ).length

  const productsWithNegativePrice = budgetItemsPreview.filter(
    (item) => Number(item.unit_price || 0) < 0
  ).length

  function handleConvertClick() {
    if (!companyId || !order) return

    if (order.status !== 'pending') {
      toast.error('Este pedido ya no está pendiente.')
      return
    }

    if (order.budget_id) {
      toast.error('Este pedido ya fue convertido a presupuesto.')
      return
    }

    if (items.length === 0) {
      toast.error('El pedido no tiene productos.')
      return
    }

    if (productsWithNegativePrice > 0) {
      toast.error('No podés convertir productos con precio negativo.')
      return
    }

    setShowConfirmModal(true)
  }

  async function convertToBudget() {
    if (!companyId || !order) return

    setShowConfirmModal(false)
    setConverting(true)

    try {
      const { data: freshOrder, error: freshOrderError } = await supabase
        .from('orders')
        .select('id, status, budget_id')
        .eq('company_id', companyId)
        .eq('id', order.id)
        .single()

      if (freshOrderError) throw freshOrderError

      if (!freshOrder || freshOrder.status !== 'pending' || freshOrder.budget_id) {
        toast.error('Este pedido ya fue procesado por otro usuario.')
        await loadOrder()
        setConverting(false)
        return
      }

      const budgetItems = buildBudgetItems()

      const total = budgetItems.reduce((acc, item) => {
        return acc + Number(item.quantity || 0) * Number(item.unit_price || 0)
      }, 0)

      const nextBudgetNumber = await getNextBudgetNumber(companyId)

      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          company_id: companyId,
          client_id: order.client_id,
          budget_number: nextBudgetNumber,
          total_amount: total,
          status: 'issued',
        })
        .select('id')
        .single()

      if (budgetError) throw budgetError
      if (!budgetData?.id) throw new Error('No se pudo crear el presupuesto.')

      const budgetId = budgetData.id

      const itemsToInsert = budgetItems.map((item) => ({
        company_id: item.company_id,
        budget_id: budgetId,
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        category: item.category,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))

      const { error: budgetItemsError } = await supabase
        .from('budget_items')
        .insert(itemsToInsert)

      if (budgetItemsError) throw budgetItemsError

      const { error: movementError } = await supabase
        .from('account_movements')
        .insert({
          company_id: companyId,
          client_id: order.client_id,
          budget_id: budgetId,
          movement_type: 'Venta',
          debit: total,
          credit: 0,
          description: `Presupuesto 000-${nextBudgetNumber} generado desde pedido ${
            order.order_code || `PED-${order.order_number}`
          }`,
        })

      if (movementError) throw movementError

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          budget_id: budgetId,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)
        .eq('id', order.id)
        .eq('status', 'pending')

      if (orderUpdateError) throw orderUpdateError

      toast.success('Pedido convertido a presupuesto correctamente.')
      router.push(`/presupuestos/${budgetId}`)
    } catch (error: unknown) {
      console.error('Error convirtiendo pedido a presupuesto:', error)

      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo convertir el pedido en presupuesto.'
      )
    } finally {
      setConverting(false)
    }
  }

  async function confirmPortalOrder() {
    if (!companyId || !order) return

    setConverting(true)

    try {
      const orderCode = getOrderLabel(order)
      
      // 1. Create Account Movement (Venta)
      const { error: movementError } = await supabase
        .from('account_movements')
        .insert({
          company_id: companyId,
          client_id: order.client_id,
          movement_date: new Date().toISOString().split('T')[0],
          movement_type: 'Venta',
          description: `Venta - Pedido ${orderCode}`,
          debit: order.total_amount || totalAmount,
          credit: 0,
        })

      if (movementError) throw movementError

      // 2. Update Order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)
        .eq('id', order.id)

      if (orderError) throw orderError

      toast.success('Pedido confirmado correctamente.')
      await loadOrder()
    } catch (err: any) {
      console.error('Error confirmando pedido:', err)
      toast.error('No se pudo confirmar el pedido.')
    } finally {
      setConverting(false)
    }
  }

  function handleCancelClick() {
    if (!companyId || !order) return

    if (order.status === 'confirmed' || order.budget_id) {
      toast.error('No podés anular un pedido ya convertido a presupuesto.')
      return
    }

    if (order.status === 'cancelled') {
      toast.error('Este pedido ya está anulado.')
      return
    }

    setShowCancelModal(true)
  }

  async function executeCancelOrder() {
    if (!companyId || !order) return
    
    setShowCancelModal(false)

    setCancelling(true)

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('id', order.id)
      .eq('status', 'pending')

    setCancelling(false)

    if (error) {
      console.error('Error anulando pedido:', error)
      toast.error('No se pudo anular el pedido.')
      return
    }

    toast.success('Pedido anulado correctamente.')
    await loadOrder()
  }

  async function sendToAccountCurrent() {
    if (!order || !companyId) return

    if (order.status === 'cancelled') {
      toast.error('No se puede pasar a cuenta corriente un pedido anulado.')
      return
    }

    if (!order.budget_id) {
      toast.error('Este pedido no tiene un presupuesto asociado para vincular el movimiento.')
      return
    }

    if (alreadyInAccount) {
      toast.info('Este pedido ya fue enviado a cuenta corriente.')
      return
    }

    try {
      setSendingToAccount(true)

      const orderLabel = order.order_code || `PED-${order.order_number}`
      
      // We calculate total from current prices/quantities if it's pending, 
      // but if it's already confirmed, it should have a budget with a total.
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('total_amount')
        .eq('id', order.budget_id)
        .single()

      const total = budgetData?.total_amount || totalAmount

      const { error } = await supabase.from('account_movements').insert({
        company_id: companyId,
        client_id: order.client_id,
        budget_id: order.budget_id,
        movement_type: 'Venta',
        debit: Number(total),
        credit: 0,
        description: `Pedido ${orderLabel}`,
      })

      if (error) throw error

      setAlreadyInAccount(true)
      toast.success('Pedido enviado a cuenta corriente.')
    } catch (err: any) {
      toast.error(err?.message || 'Error al enviar a cuenta corriente.')
    } finally {
      setSendingToAccount(false)
    }
  }

  function getOrderLabel(orderValue: Order) {
    return orderValue.order_code || `PED-${orderValue.order_number}`
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
            <Loader2 size={28} className="animate-spin" />
          </div>

          <h2 className="text-xl font-black text-slate-900">
            Cargando pedido
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            Estamos buscando los datos del pedido.
          </p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
          <XCircle size={28} />
        </div>

        <h2 className="text-xl font-black text-slate-900">
          Pedido no encontrado
        </h2>

        <p className="mt-1 text-sm font-semibold text-slate-500">
          No pudimos encontrar el pedido solicitado.
        </p>

        <Link
          href="/pedidos"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
        >
          <ArrowLeft size={18} />
          Volver a pedidos
        </Link>
      </div>
    )
  }

  const orderLabel = getOrderLabel(order)
  const isPortalOrder = order.source === 'portal'
  const canConvert = order.status === 'pending' && !order.budget_id && !isPortalOrder
  const isConverted = order.status === 'confirmed' || Boolean(order.budget_id)
  const isCancelled = order.status === 'cancelled'

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/pedidos"
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 transition hover:text-white"
            >
              <ArrowLeft size={17} />
              Volver a pedidos
            </Link>

            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <ReceiptText size={14} />
              Detalle de pedido
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Pedido {orderLabel}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {isPortalOrder 
                ? 'Detalle de la orden de venta enviada desde el portal de clientes.' 
                : 'Revisá los productos solicitados y ajustá los precios antes de convertir el pedido en presupuesto.'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <StatusBadge status={order.status} budgetId={order.budget_id} />

            {canConvert && !isPortalOrder && (
              <>
                <button
                  type="button"
                  onClick={handleCancelClick}
                  disabled={cancelling || converting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/15 px-5 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelling ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <XCircle size={18} />
                  )}
                  {cancelling ? 'Anulando...' : 'Anular'}
                </button>

                <button
                  type="button"
                  onClick={handleConvertClick}
                  disabled={converting || cancelling}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {converting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <FileText size={18} />
                  )}
                  {converting ? 'Convirtiendo...' : 'Convertir a presupuesto'}
                </button>
              </>
            )}

            {isPortalOrder && order.status === 'pending' && (
              <>
                <button
                  type="button"
                  onClick={handleCancelClick}
                  disabled={cancelling || converting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/15 px-5 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelling ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <XCircle size={18} />
                  )}
                  {cancelling ? 'Anulando...' : 'Anular'}
                </button>

                <button
                  type="button"
                  onClick={confirmPortalOrder}
                  disabled={converting || cancelling}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {converting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  {converting ? 'Confirmando...' : 'Confirmar Pedido'}
                </button>
              </>
            )}

            {isConverted && order.budget_id && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={sendToAccountCurrent}
                  disabled={sendingToAccount || alreadyInAccount || isCancelled}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg transition ${
                    alreadyInAccount || isCancelled
                      ? 'bg-slate-500 shadow-slate-900/20'
                      : 'bg-emerald-600 shadow-emerald-900/30 hover:bg-emerald-500'
                  }`}
                >
                  {sendingToAccount ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Wallet size={18} />
                  )}
                  {alreadyInAccount ? 'En cuenta corriente' : 'Pasar a cuenta corriente'}
                </button>

                <Link
                  href={`/presupuestos/${order.budget_id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700"
                >
                  <FileText size={18} />
                  Ver presupuesto
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <InfoCard
          icon={Clock3}
          title="Estado"
          value={getStatusLabel(order.status, order.budget_id)}
        />

        <InfoCard
          icon={CalendarDays}
          title="Fecha"
          value={formatDate(order.order_date || order.created_at)}
        />

        <InfoCard
          icon={User}
          title="Cliente"
          value={order.clients?.name || 'Sin cliente'}
        />

        <InfoCard
          icon={Package}
          title="Productos"
          value={String(items.length)}
        />

        <InfoCard
          icon={DollarSign}
          title={isPortalOrder || isConverted ? "Total" : "Total a presupuestar"}
          value={formatCurrency(order.total_amount || totalAmount)}
        />
      </section>

      {productsWithoutPrice > 0 && canConvert && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
          Hay {productsWithoutPrice} producto
          {productsWithoutPrice === 1 ? '' : 's'} con precio $0. Podés cargar el
          precio manualmente antes de convertir el pedido.
        </div>
      )}

      {productsWithNegativePrice > 0 && canConvert && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          Hay productos con precio negativo. Corregilos antes de convertir.
        </div>
      )}

      {isCancelled && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          Este pedido está anulado y no puede convertirse en presupuesto.
        </div>
      )}

      {isPortalOrder && order.status === 'pending' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
          Este es un pedido enviado desde el portal de clientes. Revisá el stock y confirmalo para que impacte en la cuenta corriente.
        </div>
      )}

      {isPortalOrder && order.status === 'confirmed' && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-700">
          Este pedido fue enviado desde el portal de clientes y ya se encuentra confirmado.
        </div>
      )}

      {!isPortalOrder && isConverted && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
          Este pedido ya fue convertido en presupuesto. No se puede convertir nuevamente.
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-600">
              <XCircle size={32} />
            </div>

            <h2 className="text-2xl font-black text-slate-900">
              Anular pedido
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              ¿Seguro que querés anular el pedido {orderLabel}? Esta acción
              no se puede deshacer.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="rounded-2xl px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={executeCancelOrder}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/15 px-5 py-3 text-sm font-black text-red-500 transition hover:bg-red-500 hover:text-white"
              >
                Sí, anular pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
              <FileText size={32} />
            </div>

            <h2 className="text-2xl font-black text-slate-900">
              Convertir a presupuesto
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              ¿Querés convertir este pedido en presupuesto? Se usarán los precios
              cargados en esta pantalla y se generará la deuda en cuenta
              corriente.
            </p>

            {productsWithoutPrice > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                ¡Atención! Hay {productsWithoutPrice} producto
                {productsWithoutPrice === 1 ? '' : 's'} con precio $0.
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-2xl px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={convertToBudget}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
              >
                Convertir a presupuesto
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-black text-slate-950">
            Datos del cliente
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <ClientData
              icon={User}
              label="Nombre"
              value={order.clients?.name || '-'}
            />

            <ClientData
              icon={Hash}
              label="CUIT"
              value={order.clients?.cuit || '-'}
            />

            <ClientData
              icon={MapPin}
              label="Dirección"
              value={order.clients?.address || '-'}
            />
          </div>

          {order.notes && (
            <div className="mt-5 rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Notas del pedido
              </p>

              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                {order.notes}
              </p>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Productos solicitados
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                {canConvert 
                  ? 'Los precios de esta pantalla serán los que pasen al presupuesto.'
                  : 'Detalle de los productos y precios acordados en el presupuesto.'}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-950 px-5 py-3 text-white">
              <p className="text-xs font-black uppercase tracking-widest text-blue-200">
                {canConvert ? 'Total a presupuestar' : 'Total del pedido'}
              </p>
              <p className="text-2xl font-black">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-10 text-center text-sm font-bold text-slate-500">
              Este pedido no tiene productos cargados.
            </div>
          ) : (
            <>
              <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-slate-200 xl:block">
                <table className="w-full min-w-[950px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHead>Producto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead align="right">Cantidad</TableHead>
                      <TableHead align="right">
                        {canConvert ? 'Precio a presupuestar' : 'Precio'}
                      </TableHead>
                      <TableHead align="right">Subtotal</TableHead>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const product = products.find((p) => p.id === item.product_id)
                      const unitPrice = getItemUnitPrice(item)
                      const subtotal = unitPrice * Number(item.quantity || 0)

                      return (
                        <tr
                          key={item.id}
                          className="transition hover:bg-blue-50/40"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                                <Package size={19} />
                              </div>

                              <div>
                                <p className="font-black text-slate-950">
                                  {product?.name || item.product_name}
                                </p>
                                {!product && item.product_id && (
                                  <p className="text-xs font-bold text-amber-600">
                                    Producto no encontrado en catálogo
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                              <Hash size={14} />
                              {product?.internal_code || item.product_code || '-'}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                              <Tag size={14} />
                              {product?.category || item.category || 'Sin categoría'}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right font-black text-slate-700">
                            {Number(item.quantity || 0).toLocaleString('es-AR')}
                          </td>

                          <td className="px-5 py-4 text-right">
                            {canConvert ? (
                              <input
                                type="number"
                                min="0"
                                value={itemPrices[item.id] ?? ''}
                                onChange={(e) =>
                                  updateItemPrice(item.id, e.target.value)
                                }
                                className="ml-auto w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-sm font-black text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                              />
                            ) : (
                              <span className="font-black text-slate-700">
                                {formatCurrency(unitPrice)}
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-lg font-black text-blue-700">
                            {formatCurrency(subtotal)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 space-y-3 xl:hidden">
                {items.map((item) => {
                  const product = products.find((p) => p.id === item.product_id)
                  const unitPrice = getItemUnitPrice(item)
                  const subtotal = unitPrice * Number(item.quantity || 0)

                  return (
                    <article
                      key={item.id}
                      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                          <Package size={20} />
                        </div>

                        <div>
                          <h3 className="font-black text-slate-950">
                            {product?.name || item.product_name}
                          </h3>

                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            Código: {product?.internal_code || item.product_code || '-'} ·{' '}
                            {product?.category || item.category || 'Sin categoría'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MiniData
                          label="Cant."
                          value={Number(item.quantity || 0).toLocaleString('es-AR')}
                        />

                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Precio
                          </p>

                          {canConvert ? (
                            <input
                              type="number"
                              min="0"
                              value={itemPrices[item.id] ?? ''}
                              onChange={(e) =>
                                updateItemPrice(item.id, e.target.value)
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          ) : (
                            <p className="mt-1 font-black text-slate-900">
                              {formatCurrency(unitPrice)}
                            </p>
                          )}
                        </div>

                        <div className="col-span-2">
                          <MiniData
                            label="Subtotal"
                            value={formatCurrency(subtotal)}
                            strong
                          />
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {canConvert && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={cancelling || converting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelling ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <XCircle size={18} />
            )}
            {cancelling ? 'Anulando...' : 'Anular pedido'}
          </button>

          <button
            type="button"
            onClick={handleConvertClick}
            disabled={converting || cancelling || productsWithNegativePrice > 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {converting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <FileText size={18} />
            )}
            {converting ? 'Convirtiendo...' : 'Convertir a presupuesto'}
          </button>
        </div>
      )}
    </div>
  )
}

function StatusBadge({
  status,
  budgetId,
}: {
  status: OrderStatus
  budgetId: string | null
}) {
  if (status === 'pending' && !budgetId) {
    return (
      <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">
        <Clock3 size={17} />
        Pendiente
      </span>
    )
  }

  if (status === 'confirmed' || budgetId) {
    return (
      <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
        <CheckCircle2 size={17} />
        Convertido
      </span>
    )
  }

  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">
        <XCircle size={17} />
        Anulado
      </span>
    )
  }

  return (
    <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
      <Clock3 size={17} />
      {status}
    </span>
  )
}

function InfoCard({
  icon: Icon,
  title,
  value,
}: {
  icon: any
  title: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-500">
            {title}
          </p>

          <h2 className="truncate text-xl font-black text-slate-950">
            {value}
          </h2>
        </div>
      </div>
    </div>
  )
}

function ClientData({
  icon: Icon,
  label,
  value,
}: {
  icon: any
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
        <Icon size={14} />
        {label}
      </p>

      <p className="mt-1 font-black text-slate-900">{value}</p>
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
        className={`mt-1 font-black ${
          strong ? 'text-blue-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
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

function getStatusLabel(status: OrderStatus, budgetId?: string | null) {
  if (status === 'pending' && !budgetId) return 'Pendiente'
  if (status === 'confirmed' || budgetId) return 'Convertido'
  if (status === 'cancelled') return 'Anulado'
  return String(status)
}

function formatDate(date?: string | null) {
  if (!date) return '-'

  return new Date(date).toLocaleDateString('es-AR')
}

function formatCurrency(value: number) {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}