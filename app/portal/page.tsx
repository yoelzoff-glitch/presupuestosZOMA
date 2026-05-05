'use client'

import { useEffect, useMemo, useState } from 'react'
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
  LogOut,
  FileSpreadsheet,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

type Product = {
  id: string
  internal_code: string | null
  name: string
  category: string | null
  cost_price: number | null
}

type CustomerUser = {
  id: string
  company_id: string
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

  useEffect(() => {
    loadPortal()
  }, [])

  async function loadPortal() {
    setLoading(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      router.push('/auth/login')
      return
    }

    const { data: customerData, error: customerError } = await supabase
      .from('customer_users')
      .select('id, company_id, name, email, active')
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

    setCustomer(customerData)

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, internal_code, name, category, cost_price')
      .eq('company_id', customerData.company_id)
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

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
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

  async function sendOrder() {
    if (!customer || cart.length === 0) return

    setSending(true)
    setErrorMsg('')

    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .insert({
        company_id: customer.company_id,
        customer_user_id: customer.id,
        notes,
        status: 'pending',
      })
      .select('id')
      .single()

    if (orderError || !order) {
      setErrorMsg('No se pudo crear el pedido.')
      setSending(false)
      return
    }

    const items = cart.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      quantity: item.quantity,
      product_name: item.product.name,
      internal_code: item.product.internal_code,
      unit_price: Number(item.product.cost_price || 0),
      total_price: Number(item.product.cost_price || 0) * item.quantity,
    }))

    const { error: itemsError } = await supabase
      .from('customer_order_items')
      .insert(items)

    if (itemsError) {
      setErrorMsg('El pedido se creó, pero hubo un error al cargar los productos.')
      setSending(false)
      return
    }

    alert('Pedido enviado correctamente.')

    setCart([])
    setNotes('')
    setSending(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" size={32} />
          <p className="font-bold text-slate-700">Cargando portal...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-16 h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
                <Package size={14} />
                Portal cliente
              </div>

              <h1 className="text-3xl font-black">
                Lista de precios
              </h1>

              <p className="mt-1 text-sm text-slate-300">
                Hola, {customer?.name}. Armá tu pedido desde acá.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={exportPriceListXlsm}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
              >
                <FileSpreadsheet size={17} />
                Exportar XLSM
              </button>

              <button
                onClick={logout}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
              >
                <LogOut size={17} />
                Salir
              </button>
            </div>
          </div>
        </section>

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
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

            {filteredProducts.length === 0 ? (
              <div className="p-10 text-center text-sm font-bold text-slate-500">
                No hay productos para mostrar.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-col gap-3 p-4 transition hover:bg-blue-50/40 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-950">
                        {product.name}
                      </p>

                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                        <span>Código: {product.internal_code || '-'}</span>
                        <span>Categoría: {product.category || '-'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 md:justify-end">
                      <p className="text-lg font-black text-blue-700">
                        {formatCurrency(Number(product.cost_price || 0))}
                      </p>

                      <button
                        onClick={() => addToCart(product)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
                      >
                        <Plus size={16} />
                        Agregar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <ShoppingCart size={22} />
                </div>

                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Pedido
                  </h2>
                  <p className="text-sm text-slate-500">
                    {cart.length} producto{cart.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-5">
              {cart.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
                  Todavía no agregaste productos.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="rounded-2xl border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {item.product.name}
                        </p>
                        <p className="mt-1 text-xs font-bold text-blue-700">
                          {formatCurrency(Number(item.product.cost_price || 0))}
                        </p>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => decreaseQuantity(item.product.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          <Minus size={14} />
                        </button>

                        <span className="w-8 text-center text-sm font-black">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() => increaseQuantity(item.product.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <p className="text-sm font-black text-slate-900">
                        {formatCurrency(
                          Number(item.product.cost_price || 0) * item.quantity
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones del pedido..."
                className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />

              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-300">
                    Total estimado
                  </span>
                  <span className="text-xl font-black">
                    {formatCurrency(cartTotal)}
                  </span>
                </div>
              </div>

              <button
                onClick={sendOrder}
                disabled={sending || cart.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                {sending ? 'Enviando...' : 'Enviar pedido'}
              </button>
            </div>
          </aside>
        </div>
      </div>
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