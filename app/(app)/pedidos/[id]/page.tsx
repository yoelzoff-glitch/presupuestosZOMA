'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
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
  Tag,
  User,
  XCircle,
  Wallet,
  Zap,
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
  seller_id: string | null
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
  discount_str: string | null
}

type Product = {
  id: string
  internal_code: string | null
  name: string
  category: string | null
  cost_price: number | null
  sale_price: number | null
}

type BudgetItemPreview = {
  company_id: string
  product_id: string | null
  product_code: string | null
  product_name: string
  category: string | null
  quantity: number
  unit_price: number
  discount_str?: string | null
}

// Helper functions
function getOrderLabel(orderValue: Order) {
  return orderValue.order_code || `PED-${orderValue.order_number}`
}

function getStatusLabel(status: OrderStatus, budgetId?: string | null) {
  if (status === 'pending') return 'Pendiente'
  if (status === 'confirmed') return 'Convertido'
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

// Sub-components
function StatusBadge({
  status,
  budgetId,
}: {
  status: OrderStatus
  budgetId: string | null
}) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">
        <Clock3 size={17} />
        Pendiente
      </span>
    )
  }

  if (status === 'confirmed') {
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
        className={`mt-1 font-black ${strong ? 'text-blue-700' : 'text-slate-900'}`}
      >
        {value}
      </p>
    </div>
  )
}

export default function PedidoDetallePage(): any {
  const params = useParams()
  const router = useRouter()

  const orderId = params.id as string

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
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

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      toast.error('Sesión no encontrada.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id, role')
      .eq('id', userData.user.id)
      .single()

    if (!profile?.company_id) {
      toast.error('No se encontró el perfil del usuario.')
      setLoading(false)
      return
    }

    const currentCompanyId = profile.company_id
    setRole(profile.role || 'vendedor')
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
        seller_id,
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
        unit_price,
        discount_str
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
        .select('id, internal_code, name, category, cost_price, sale_price')
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

      loadedItems.forEach((item) => {
        const bItem = bItemsData?.find(bi => bi.product_code === item.product_code)
        if (bItem) {
          initialPrices[item.id] = String(bItem.unit_price)
        } else {
          // Fallback to item price or product cost
          if (item.unit_price !== null && item.unit_price !== undefined) {
            initialPrices[item.id] = String(item.unit_price)
          } else {
            const product = productsData.find((p) => p.id === item.product_id)
            initialPrices[item.id] = String(product?.sale_price || product?.cost_price || 0)
          }
        }
      })
    } else {
      loadedItems.forEach((item) => {
        // Priorizar el precio guardado en el ítem (portal)
        if (item.unit_price !== null && item.unit_price !== undefined) {
          initialPrices[item.id] = String(item.unit_price)
        } else {
          const product = productsData.find((p) => p.id === item.product_id)
          const price = Number(product?.sale_price || product?.cost_price || 0)
          initialPrices[item.id] = String(price)
        }
      })
    }

    setOrder(normalizedOrder)
    setItems(loadedItems)
    setProducts(productsData)
    setItemPrices(initialPrices)

    // Check if already in account current
    const orderCodeForSearch = normalizedOrder.order_code || `PED-${normalizedOrder.order_number}`

    const { data: movement } = await supabase
      .from('account_movements')
      .select('id')
      .or(`budget_id.eq.${normalizedOrder.budget_id || '00000000-0000-0000-0000-000000000000'},description.ilike.%${orderCodeForSearch}%`)
      .maybeSingle()

    if (movement) setAlreadyInAccount(true)

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
        discount_str: item.discount_str
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

  async function confirmPortalOrder() {
    if (!companyId || !order) return

    setConverting(true)

    try {
      let budgetId = order.budget_id

      // 1. Si no tiene presupuesto (ej: pedido directo), lo creamos
      if (!budgetId) {
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
            seller_id: order.seller_id,
          })
          .select('id')
          .single()

        if (budgetError) throw budgetError
        if (!budgetData?.id) throw new Error('No se pudo crear el presupuesto espejo.')

        budgetId = budgetData.id

        // Insertar ítems del presupuesto
        const itemsToInsert = budgetItems.map((item) => ({
          company_id: item.company_id,
          budget_id: budgetId,
          product_id: item.product_id,
          product_code: item.product_code,
          product_name: item.product_name,
          category: item.category,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_str: item.discount_str,
        }))

        const { error: budgetItemsError } = await supabase
          .from('budget_items')
          .insert(itemsToInsert)

        if (budgetItemsError) throw budgetItemsError
      }

      // 2. Actualizar estado del Pedido (SIN crear movimiento todavía)
      const total = buildBudgetItems().reduce((acc, item) => {
        return acc + Number(item.quantity || 0) * Number(item.unit_price || 0)
      }, 0)

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          budget_id: budgetId,
          total_amount: total,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)
        .eq('id', order.id)

      if (orderError) throw orderError

      // 3. Actualizar estado del presupuesto a 'approved'
      if (budgetId) {
        await supabase
          .from('budgets')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', budgetId)
      }

      toast.success('Pedido confirmado correctamente. Ahora podés pasarlo a cuenta corriente cuando desees.')

      if (order.seller_id) {
        await supabase.from('notifications').insert({
          company_id: companyId,
          user_id: order.seller_id,
          title: '¡Pedido Aceptado!',
          message: `El Admin aceptó el pedido ${orderLabel}. Ya podés gestionarlo.`,
          type: 'order_accepted',
          link: `/pedidos/${order.id}`
        })
      }

      await loadOrder()
    } catch (err: any) {
      console.error('Error confirmando pedido:', err)
      toast.error(err.message || 'No se pudo confirmar el pedido.')
    } finally {
      setConverting(false)
      setShowConfirmModal(false)
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

    if (order.seller_id) {
      await supabase.from('notifications').insert({
        company_id: companyId,
        user_id: order.seller_id,
        title: 'Pedido Anulado',
        message: `El pedido ${orderLabel} fue anulado por el administrador.`,
        type: 'order_cancelled',
        link: `/pedidos/${order.id}`
      })
    }

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

      let total = order.total_amount || totalAmount

      if (order.budget_id) {
        const { data: budgetData } = await supabase
          .from('budgets')
          .select('total_amount')
          .eq('id', order.budget_id)
          .single()

        if (budgetData) total = budgetData.total_amount
      }

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
  const canConvert = order.status === 'pending'
  const isConverted = order.status === 'confirmed'
  const isCancelled = order.status === 'cancelled'

  return (
    <div id="pedido-detalle-container" className="space-y-6">
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
              <FileText size={14} />
              Detalle de pedido
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Pedido {orderLabel}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {isPortalOrder
                ? 'Detalle de la orden de venta enviada desde el portal de clientes.'
                : 'Detalle del pedido generado manualmente por el vendedor.'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <StatusBadge status={order.status} budgetId={order.budget_id} />

            {role === 'admin' && canConvert && (
              <>
                <button
                  onClick={handleConvertClick}
                  disabled={converting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {converting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  Aceptar Pedido
                </button>

                <button
                  onClick={handleCancelClick}
                  disabled={cancelling}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-red-900/30 transition hover:bg-red-500 disabled:opacity-50"
                >
                  {cancelling ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <XCircle size={18} />
                  )}
                  Anular Pedido
                </button>
              </>
            )}

            {role === 'admin' && isConverted && !alreadyInAccount && (
              <button
                onClick={sendToAccountCurrent}
                disabled={sendingToAccount}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {sendingToAccount ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Wallet size={18} />
                )}
                Pasar a Cuenta Corriente
              </button>
            )}
            
            {alreadyInAccount && (
              <div className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-black text-white shadow-lg">
                <CheckCircle2 size={18} />
                En Cuenta Corriente
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <InfoCard
          icon={User}
          title="Cliente"
          value={order.clients?.name || 'Cargando...'}
        />

        <InfoCard
          icon={CalendarDays}
          title="Fecha"
          value={formatDate(order.order_date || order.created_at)}
        />

        <InfoCard
          icon={DollarSign}
          title="Total"
          value={formatCurrency(order.total_amount || totalAmount)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-6 lg:col-span-3">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Productos solicitados
                </h2>
                <p className="text-sm font-bold text-slate-500">
                  {items.length} productos en esta orden.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 text-left text-xs font-black uppercase tracking-widest text-slate-400">
                      Producto
                    </th>
                    <th className="pb-4 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                      Cant.
                    </th>
                    <th className="pb-4 text-right text-xs font-black uppercase tracking-widest text-slate-400">
                      Precio Unit.
                    </th>
                    <th className="pb-4 text-right text-xs font-black uppercase tracking-widest text-slate-400">
                      Subtotal
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-50">
                  {items.map((item) => {
                    const price = getItemUnitPrice(item)
                    const subtotal = Number(item.quantity || 0) * price

                    return (
                      <tr key={item.id} className="group transition hover:bg-slate-50/50">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                              <Package size={18} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-black text-slate-900">
                                {item.product_name}
                              </p>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  {item.product_code || 'S/C'}
                                </span>
                                {item.discount_str && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600">
                                    <Zap size={10} />
                                    -{item.discount_str}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 text-center">
                          <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-xl bg-slate-100 px-2 text-sm font-black text-slate-900">
                            {item.quantity}
                          </span>
                        </td>

                        <td className="py-4 text-right">
                          {canConvert ? (
                            <div className="relative inline-block w-32">
                              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="number"
                                value={itemPrices[item.id] || ''}
                                onChange={(e) => updateItemPrice(item.id, e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-right text-sm font-black text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                              />
                            </div>
                          ) : (
                            <span className="font-black text-slate-900">
                              {formatCurrency(price)}
                            </span>
                          )}
                        </td>

                        <td className="py-4 text-right font-black text-blue-600">
                          {formatCurrency(subtotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-8 rounded-3xl border-2 border-dashed border-slate-100 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Notas del pedido
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-600">
                    {order.notes || 'No hay notas adicionales.'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Total Final
                  </p>
                  <p className="text-3xl font-black text-slate-950">
                    {formatCurrency(order.total_amount || totalAmount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6 lg:col-span-2">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-black text-slate-950">
              Datos del Cliente
            </h3>

            <div className="space-y-3">
              <ClientData
                icon={User}
                label="Nombre / Razón Social"
                value={order.clients?.name || '-'}
              />

              <ClientData
                icon={Hash}
                label="CUIT / DNI"
                value={order.clients?.cuit || '-'}
              />

              <ClientData
                icon={MapPin}
                label="Dirección"
                value={order.clients?.address || '-'}
              />
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-black text-slate-950">
              Información de la Orden
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <MiniData
                label="Nro. de Pedido"
                value={String(order.order_number)}
              />

              <MiniData label="Origen" value={order.source || 'Manual'} />

              <MiniData
                label="Fecha de Solicitud"
                value={formatDate(order.created_at)}
              />

              <MiniData
                label="ID de Presupuesto"
                value={order.budget_id ? 'Vincualdo' : 'Sin Presupuesto'}
                strong={!!order.budget_id}
              />
            </div>
          </div>

          {order.budget_id && (
            <Link
              href={`/presupuestos/${order.budget_id}`}
              className="flex items-center justify-center gap-3 rounded-2xl bg-slate-900 py-4 text-sm font-black text-white shadow-lg transition hover:bg-slate-800"
            >
              <FileText size={18} />
              Ver Presupuesto Original
            </Link>
          )}
        </aside>
      </div>

      {/* MODALES (Simplificados para brevedad en esta respuesta) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-950">Confirmar Pedido</h2>
            <p className="mt-2 font-bold text-slate-500 leading-relaxed">
              ¿Estás seguro de que querés aceptar este pedido? Se generará un presupuesto aprobado automáticamente.
            </p>
            
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPortalOrder}
                className="flex-1 rounded-2xl bg-blue-600 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-950 text-red-600">Anular Pedido</h2>
            <p className="mt-2 font-bold text-slate-500 leading-relaxed">
              ¿Estás seguro de que querés anular este pedido? Esta acción no se puede deshacer.
            </p>
            
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              >
                Volver
              </button>
              <button
                onClick={executeCancelOrder}
                className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-black text-white shadow-lg shadow-red-900/20 transition hover:bg-red-500"
              >
                Anular ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
