'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Send,
  Loader2,
  Package,
  FileSpreadsheet,
  AlertCircle,
  ClipboardList,
} from 'lucide-react'
import * as XLSX from 'xlsx'

type Product = {
  id: string
  internal_code: string | null
  name: string
  category: string | null
  cost_price: number | null
  active?: boolean | null
}

type CustomerUser = {
  id: string
  company_id: string
  client_id: string | null
  name: string
  email: string
  active: boolean
}

type CartItem = {
  product: Product
  quantity: number
}

export default function PortalPage() {
  const router = useRouter()

  const [customer, setCustomer] = useState<CustomerUser | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    loadPortal()
  }, [])

  async function loadPortal() {
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
      setErrorMsg('No se encontró el usuario cliente.')
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

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, internal_code, name, category, cost_price, active')
      .eq('company_id', customerData.company_id)
      .eq('active', true)
      .order('name', { ascending: true })
      .range(0, 4999)

    if (productsError) {
      setErrorMsg('Error al cargar la lista de precios.')
      setLoading(false)
      return
    }

    setProducts(productsData || [])
    setLoading(false)
  }

  function exportPriceListXlsm() {
    const rows = filteredProducts.map((product) => ({
      Código: product.internal_code || '',
      Producto: product.name || '',
      Categoría: product.category || '',
      Precio: Number(product.cost_price || 0),
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)

    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 45 },
      { wch: 25 },
      { wch: 15 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lista de precios')

    XLSX.writeFile(workbook, 'lista-de-precios.xlsm', {
      bookType: 'xlsm',
    })
  }

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim()

    if (!q) return products

    return products.filter((product) => {
      return (
        product.name?.toLowerCase().includes(q) ||
        product.internal_code?.toLowerCase().includes(q) ||
        product.category?.toLowerCase().includes(q)
      )
    })
  }, [products, search])

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      return acc + Number(item.product.cost_price || 0) * item.quantity
    }, 0)
  }, [cart])

  function addToCart(product: Product) {
    setErrorMsg('')
    setSuccessMsg('')

    setCart((prev) => {
      const exists = prev.find((item) => item.product.id === product.id)

      if (exists) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [...prev, { product, quantity: 1 }]
    })
  }

  function increaseQuantity(productId: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    )
  }

  function decreaseQuantity(productId: string) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }

  async function getNextOrderNumber(companyId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('order_number')
      .eq('company_id', companyId)
      .order('order_number', { ascending: false })
      .limit(1)

    if (error) throw error

    const lastNumber = data?.[0]?.order_number || 0
    return lastNumber + 1
  }

  async function createOrderNotification({
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
    const res = await fetch('/api/notifications/order', {
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
      console.error('Error creando notificación:', data)
      return false
    }

    return true
  }

  async function sendOrder() {
    if (!customer) {
      setErrorMsg('No se encontró el usuario cliente.')
      return
    }

    if (!customer.client_id) {
      setErrorMsg('Tu usuario no tiene un cliente del sistema enlazado.')
      return
    }

    if (cart.length === 0) {
      setErrorMsg('Agregá al menos un producto al pedido.')
      return
    }

    const invalidItem = cart.find((item) => !item.quantity || item.quantity <= 0)

    if (invalidItem) {
      setErrorMsg('Hay productos con cantidad inválida.')
      return
    }

    setSending(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const nextNumber = await getNextOrderNumber(customer.company_id)
      const orderCode = `PED-${String(nextNumber).padStart(6, '0')}`

      // Calculate totals
      const totalAmount = cart.reduce((acc, item) => {
        return acc + Number(item.product.cost_price || 0) * item.quantity
      }, 0)

      // 1. Insert Order as confirmed
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          company_id: customer.company_id,
          client_id: customer.client_id,
          order_number: nextNumber,
          order_code: orderCode,
          status: 'confirmed',
          source: 'portal',
          total_amount: totalAmount,
          notes: notes.trim() || 'Pedido enviado desde portal cliente',
        })
        .select('id')
        .single()

      if (orderError) throw orderError
      if (!orderData?.id) throw new Error('No se pudo crear el pedido.')

      const orderId = orderData.id

      // 2. Insert Items with unit prices
      const itemsToInsert = cart.map((item) => ({
        company_id: customer.company_id,
        order_id: orderId,
        product_id: item.product.id,
        product_code: item.product.internal_code,
        product_name: item.product.name,
        category: item.product.category,
        quantity: item.quantity,
        unit_price: Number(item.product.cost_price || 0),
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      // 3. Create Account Movement (Venta)
      const { error: movementError } = await supabase
        .from('account_movements')
        .insert({
          company_id: customer.company_id,
          client_id: customer.client_id,
          movement_date: new Date().toISOString().split('T')[0],
          movement_type: 'Venta',
          description: `Venta - Pedido ${orderCode}`,
          debit: totalAmount,
          credit: 0,
        })

      if (movementError) {
        console.error('Error creando movimiento:', movementError)
      }

      // 4. Notification
      const notificationCreated = await createOrderNotification({
        companyId: customer.company_id,
        orderId,
        orderCode,
        customerName: customer.name,
      })

      setSuccessMsg(`¡Pedido ${orderCode} enviado correctamente! Ya puedes verlo en tu historial.`)
      setCart([])
      setNotes('')
    } catch (error) {
      console.error('Error enviando pedido:', error)
      setErrorMsg('No se pudo enviar el pedido.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <Loader2
            className="mx-auto mb-3 animate-spin text-blue-600"
            size={32}
          />
          <p className="font-bold text-slate-700">Cargando portal...</p>
        </div>
      </div>
    )
  }

  if (errorMsg && products.length === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-100 text-red-700">
          <AlertCircle size={32} />
        </div>

        <h1 className="text-2xl font-black text-red-900">
          No pudimos cargar el portal
        </h1>

        <p className="mt-2 text-sm font-semibold leading-6 text-red-800">
          {errorMsg}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-200">
              <Package size={14} />
              Portal cliente
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Lista de precios
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Buscá productos, armá tu solicitud y enviala. Recibirás un presupuesto
              basado en tu selección.
            </p>
          </div>

          <button
            type="button"
            onClick={exportPriceListXlsm}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
          >
            <FileSpreadsheet size={18} />
            Descargar lista
          </button>
        </div>
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

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto, código o categoría..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <Package size={22} />
                  </div>

                  <div className="min-w-0">
                    <h2 className="line-clamp-2 font-black text-slate-950">
                      {product.name}
                    </h2>

                    <p className="mt-1 text-xs font-bold text-slate-400">
                      Código: {product.internal_code || '-'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Precio de referencia
                  </p>

                  <p className="mt-1 text-2xl font-black text-blue-700">
                    {formatCurrency(Number(product.cost_price || 0))}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {product.category || 'Sin categoría'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => addToCart(product)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
                >
                  <Plus size={18} />
                  Agregar
                </button>
              </article>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                <Package size={26} />
              </div>

              <h3 className="text-lg font-black text-slate-900">
                No encontramos productos
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Probá cambiar la búsqueda. 
              </p>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                <ClipboardList size={22} className="text-blue-600" />
                Tu Solicitud
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                {cart.length} producto{cart.length === 1 ? '' : 's'} seleccionado
                {cart.length === 1 ? '' : 's'}.
              </p>
            </div>

            {cart.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                  <ShoppingCart size={26} />
                </div>

                <h3 className="font-black text-slate-900">Solicitud vacía</h3>

                <p className="mt-1 text-sm text-slate-500">
                  Agregá productos para enviar tu solicitud.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <div key={item.product.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">
                          {item.product.name}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          {item.product.internal_code || '-'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                        aria-label="Quitar producto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => decreaseQuantity(item.product.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                        >
                          <Minus size={15} />
                        </button>

                        <span className="min-w-10 text-center font-black text-slate-950">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() => increaseQuantity(item.product.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                        >
                          <Plus size={15} />
                        </button>
                      </div>

                      <p className="font-black text-blue-700">
                        {formatCurrency(
                          Number(item.product.cost_price || 0) * item.quantity
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-200 p-5">
              <label className="mb-2 block text-sm font-black text-slate-700">
                Notas
              </label>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: entregar la semana próxima..."
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />

              <div className="mt-5 flex items-center justify-between">
                <p className="text-sm font-black uppercase tracking-widest text-slate-400">
                  Total ref.
                </p>

                <p className="text-2xl font-black text-slate-950">
                  {formatCurrency(cartTotal)}
                </p>
              </div>

              <button
                type="button"
                onClick={sendOrder}
                disabled={sending || cart.length === 0}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}

                {sending ? 'Enviando...' : 'Enviar solicitud de presupuesto'}
              </button>

              <p className="mt-3 text-center text-xs font-semibold text-slate-400">
                La solicitud ingresará como pendiente. El presupuesto lo genera la empresa.
              </p>
            </div>
          </section>
        </aside>
      </section>
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