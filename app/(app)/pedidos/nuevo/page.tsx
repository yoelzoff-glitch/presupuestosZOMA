'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getUserCompanyId } from '@/lib/getUserCompany'

type Client = {
  id: string
  name: string
  cuit: string
  address: string | null
}

type Product = {
  id: string
  internal_code: string | null
  name: string
  category: string | null
  supplier: string | null
  active: boolean
}

type CartItem = {
  product_id: string | null
  product_code: string | null
  product_name: string
  category: string | null
  quantity: number
}

export default function NuevoPedidoPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [clientId, setClientId] = useState('')
  const [notes, setNotes] = useState('')

  const [productSearch, setProductSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState('1')

  const [manualCode, setManualCode] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualCategory, setManualCategory] = useState('')
  const [manualQuantity, setManualQuantity] = useState('1')

  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const id = await getUserCompanyId()

    if (!id) {
      alert('No se encontró la empresa del usuario.')
      setLoading(false)
      return
    }

    setCompanyId(id)

    const [clientsRes, productsRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, cuit, address')
        .eq('company_id', id)
        .eq('active', true)
        .order('name', { ascending: true }),

      supabase
        .from('products')
        .select('id, internal_code, name, category, supplier, active')
        .eq('company_id', id)
        .eq('active', true)
        .order('name', { ascending: true })
        .range(0, 4999),
    ])

    if (clientsRes.error) {
      console.error(clientsRes.error)
      alert('Error cargando clientes')
    } else {
      setClients(clientsRes.data || [])
    }

    if (productsRes.error) {
      console.error(productsRes.error)
      alert('Error cargando productos')
    } else {
      setProducts(productsRes.data || [])
    }

    setLoading(false)
  }

  const filteredProducts = useMemo(() => {
    const text = productSearch.toLowerCase().trim()

    if (!text) return products.slice(0, 80)

    return products
      .filter((p) => {
        return (
          p.name.toLowerCase().includes(text) ||
          p.internal_code?.toLowerCase().includes(text) ||
          p.category?.toLowerCase().includes(text) ||
          p.supplier?.toLowerCase().includes(text)
        )
      })
      .slice(0, 80)
  }, [products, productSearch])

  function addProductItem() {
    const product = products.find((p) => p.id === selectedProductId)

    if (!product) {
      alert('Seleccioná un producto.')
      return
    }

    const qty = Number(quantity)

    if (!qty || qty <= 0) {
      alert('Ingresá una cantidad válida.')
      return
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product_id === product.id)

      if (existingIndex >= 0) {
        const copy = [...prev]
        copy[existingIndex] = {
          ...copy[existingIndex],
          quantity: copy[existingIndex].quantity + qty,
        }
        return copy
      }

      return [
        ...prev,
        {
          product_id: product.id,
          product_code: product.internal_code,
          product_name: product.name,
          category: product.category,
          quantity: qty,
        },
      ]
    })

    setSelectedProductId('')
    setQuantity('1')
    setProductSearch('')
  }

  function addManualItem() {
    const qty = Number(manualQuantity)

    if (!manualName.trim()) {
      alert('Ingresá el nombre del producto.')
      return
    }

    if (!qty || qty <= 0) {
      alert('Ingresá una cantidad válida.')
      return
    }

    setItems((prev) => [
      ...prev,
      {
        product_id: null,
        product_code: manualCode.trim() || null,
        product_name: manualName.trim(),
        category: manualCategory.trim() || null,
        quantity: qty,
      },
    ])

    setManualCode('')
    setManualName('')
    setManualCategory('')
    setManualQuantity('1')
  }

  function updateQuantity(index: number, value: string) {
    const qty = Number(value)

    setItems((prev) => {
      const copy = [...prev]
      copy[index] = {
        ...copy[index],
        quantity: qty,
      }
      return copy
    })
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function getNextOrderNumber(id: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('order_number')
      .eq('company_id', id)
      .order('order_number', { ascending: false })
      .limit(1)

    if (error) throw error

    const lastNumber = data?.[0]?.order_number || 0
    return lastNumber + 1
  }

  async function saveOrder() {
    if (!companyId) {
      alert('No se encontró la empresa.')
      return
    }

    if (!clientId) {
      alert('Seleccioná un cliente.')
      return
    }

    if (items.length === 0) {
      alert('Agregá al menos un producto al pedido.')
      return
    }

    const invalidItem = items.find((item) => !item.quantity || item.quantity <= 0)

    if (invalidItem) {
      alert('Hay productos con cantidad inválida.')
      return
    }

    setSaving(true)

    try {
      const nextNumber = await getNextOrderNumber(companyId)
      const orderCode = `PED-${String(nextNumber).padStart(6, '0')}`

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          company_id: companyId,
          client_id: clientId,
          order_number: nextNumber,
          order_code: orderCode,
          status: 'pending',
          notes: notes.trim() || null,
        })
        .select('id')
        .single()

      if (orderError) throw orderError

      const orderId = orderData.id

      const itemsToInsert = items.map((item) => ({
        company_id: companyId,
        order_id: orderId,
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        category: item.category,
        quantity: item.quantity,
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      router.push(`/pedidos/${orderId}`)
    } catch (error) {
      console.error('Error guardando pedido:', error)
      alert('No se pudo guardar el pedido.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-8 text-slate-500 shadow-sm">
          Cargando...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-sm font-medium text-blue-300">Nuevo pedido</p>
          <h1 className="mt-1 text-3xl font-bold">Cargar pedido sin precios</h1>
          <p className="mt-2 text-sm text-slate-300">
            El pedido guarda productos y cantidades. Los precios se toman recién al convertirlo en presupuesto.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Datos del pedido</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Cliente</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Seleccionar cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} - {client.cuit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Notas</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: entregar en 20 días"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Agregar producto del listado</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Buscar producto</label>
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar por código, nombre, categoría o proveedor..."
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Producto</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Seleccionar</option>
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.internal_code ? `${product.internal_code} - ` : ''}
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Cantidad</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <button
                  type="button"
                  onClick={addProductItem}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Agregar producto manual</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-5">
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Código"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Producto"
              className="md:col-span-2 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <input
              value={manualCategory}
              onChange={(e) => setManualCategory(e.target.value)}
              placeholder="Categoría"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={manualQuantity}
                onChange={(e) => setManualQuantity(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <button
                type="button"
                onClick={addManualItem}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Agregar
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Productos del pedido</h2>
            <p className="text-sm text-slate-500">{items.length} productos</p>
          </div>

          <div className="mt-4 overflow-x-auto">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Todavía no agregaste productos.
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Cantidad</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, index) => (
                    <tr key={`${item.product_id}-${index}`} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-600">{item.product_code || '-'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{item.product_name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.category || '-'}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(index, e.target.value)}
                          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/pedidos')}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={saveOrder}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar pedido'}
          </button>
        </div>
      </div>
    </main>
  )
}