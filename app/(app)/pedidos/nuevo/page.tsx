'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getUserCompanyId } from '@/lib/getUserCompany'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ClipboardList,
  Plus,
  Search,
  User as UserIcon,
  IdCard,
  MapPin,
  Package as PackageIcon,
  Hash,
  Tag,
  Truck,
  Trash2,
  Save,
  Loader2,
  FileText,
  Boxes,
  DollarSign as DollarSignIcon,
} from 'lucide-react'

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
  cost_price: number | null
}

type CartItem = {
  product_id: string | null
  product_code: string | null
  product_name: string
  category: string | null
  quantity: number
  unit_price: number
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
  const [unitPrice, setUnitPrice] = useState('0')

  const [manualCode, setManualCode] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualCategory, setManualCategory] = useState('')
  const [manualQuantity, setManualQuantity] = useState('1')
  const [manualPrice, setManualPrice] = useState('0')

  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const p = products.find((prod) => prod.id === selectedProductId)
    if (p) {
      setUnitPrice(String(p.cost_price || 0))
    }
  }, [selectedProductId, products])

  async function loadData() {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      toast.error('No se pudo autenticar al usuario.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('users_profiles')
      .select('company_id, role')
      .eq('id', userData.user.id)
      .single()

    if (profileError || !profile?.company_id) {
      toast.error('No se encontró el perfil del usuario.')
      setLoading(false)
      return
    }

    const currentCompanyId = profile.company_id
    setCompanyId(currentCompanyId)

    let clientsQuery = supabase
      .from('clients')
      .select('id, name, cuit, address')
      .eq('company_id', currentCompanyId)
      .eq('active', true)

    if (profile.role === 'vendedor') {
      clientsQuery = clientsQuery.eq('seller_id', userData.user.id)
    }

    const [clientsRes, productsRes] = await Promise.all([
      clientsQuery.order('name', { ascending: true }),

      supabase
        .from('products')
        .select('id, internal_code, name, category, supplier, active, cost_price')
        .eq('company_id', currentCompanyId)
        .eq('active', true)
        .order('name', { ascending: true })
        .range(0, 4999),
    ])

    if (clientsRes.error) {
      console.error('Error cargando clientes:', clientsRes.error)
      toast.error('Error cargando clientes.')
    } else {
      setClients(clientsRes.data || [])
    }

    if (productsRes.error) {
      console.error('Error cargando productos:', productsRes.error)
      toast.error('Error cargando productos.')
    } else {
      setProducts(productsRes.data || [])
    }

    setLoading(false)
  }

  const selectedClient = clients.find((client) => client.id === clientId)
  const selectedProduct = products.find((product) => product.id === selectedProductId)

  const filteredProducts = useMemo(() => {
    const text = productSearch.toLowerCase().trim()

    if (!text) return products.slice(0, 80)

    return products
      .filter((product) => {
        return (
          product.name.toLowerCase().includes(text) ||
          product.internal_code?.toLowerCase().includes(text) ||
          product.category?.toLowerCase().includes(text) ||
          product.supplier?.toLowerCase().includes(text)
        )
      })
      .slice(0, 80)
  }, [products, productSearch])

  const totalAmount = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0)
  }, [items])

  const totalUnits = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.quantity || 0), 0)
  }, [items])

  const canSave = Boolean(companyId && clientId && items.length > 0 && !saving)

  const saveButtonText = saving
    ? 'Guardando...'
    : !clientId
      ? 'Seleccioná un cliente'
      : items.length === 0
        ? 'Agregá productos'
        : 'Guardar pedido pendiente'

  function addProductItem() {
    const product = products.find((p) => p.id === selectedProductId)

    if (!product) {
      toast.error('Seleccioná un producto.')
      return
    }

    const qty = Number(quantity)
    const price = Number(unitPrice)

    if (!qty || qty <= 0) {
      toast.error('Ingresá una cantidad válida.')
      return
    }

    if (Number.isNaN(price) || price < 0) {
      toast.error('Ingresá un precio válido.')
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
          unit_price: price,
        },
      ]
    })

    setSelectedProductId('')
    setQuantity('1')
    setUnitPrice('0')
    setProductSearch('')
  }

  function addManualItem() {
    const qty = Number(manualQuantity)
    const price = Number(manualPrice)

    if (!manualName.trim()) {
      toast.error('Ingresá el nombre del producto.')
      return
    }

    if (!qty || qty <= 0) {
      toast.error('Ingresá una cantidad válida.')
      return
    }

    if (Number.isNaN(price) || price < 0) {
      toast.error('Ingresá un precio válido.')
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
        unit_price: price,
      },
    ])

    setManualCode('')
    setManualName('')
    setManualCategory('')
    setManualQuantity('1')
    setManualPrice('0')
  }

  function updateQuantity(index: number, value: string) {
    const qty = Number(value)

    setItems((prev) => {
      const copy = [...prev]

      copy[index] = {
        ...copy[index],
        quantity: Number.isNaN(qty) ? 0 : qty,
      }

      return copy
    })
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function getNextOrderNumber(currentCompanyId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('order_number')
      .eq('company_id', currentCompanyId)
      .order('order_number', { ascending: false })
      .limit(1)

    if (error) throw error

    const lastNumber = data?.[0]?.order_number || 0
    return lastNumber + 1
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

  async function saveOrder() {
    if (!companyId) {
      toast.error('No se encontró la empresa.')
      return
    }

    if (!clientId) {
      toast.error('Seleccioná un cliente.')
      return
    }

    if (items.length === 0) {
      toast.error('Agregá al menos un producto al pedido.')
      return
    }

    const invalidItem = items.find((item) => !item.quantity || item.quantity <= 0)

    if (invalidItem) {
      toast.error('Hay productos con cantidad inválida.')
      return
    }

    setSaving(true)

    try {
      const nextNumber = await getNextOrderNumber(companyId)
      const orderCode = `PED-${String(nextNumber).padStart(6, '0')}`

      const { data: userData } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('role')
        .eq('id', userData.user?.id)
        .single()

      // 1. Crear Presupuesto Espejo (Auditoría)
      const nextBudgetNumber = await getNextBudgetNumber(companyId)
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          company_id: companyId,
          client_id: clientId,
          budget_number: nextBudgetNumber,
          total_amount: totalAmount,
          status: 'issued', // Cambiado de 'converted' por restricción de BD
          seller_id: profile?.role === 'vendedor' ? userData.user?.id : null,
        })
        .select('id')
        .single()

      if (budgetError) throw budgetError
      if (!budgetData?.id) throw new Error('No se pudo crear el presupuesto de respaldo.')

      // 2. Insertar ítems del presupuesto
      const budgetItemsToInsert = items.map((item) => ({
        company_id: companyId,
        budget_id: budgetData.id,
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        category: item.category,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))

      const { error: budgetItemsError } = await supabase
        .from('budget_items')
        .insert(budgetItemsToInsert)

      if (budgetItemsError) throw budgetItemsError

      // 3. Crear el Pedido vinculado al presupuesto
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          company_id: companyId,
          client_id: clientId,
          order_number: nextNumber,
          order_code: orderCode,
          status: 'pending',
          source: 'manual',
          total_amount: totalAmount,
          budget_id: budgetData.id, // Vínculo obligatorio
          seller_id: profile?.role === 'vendedor' ? userData.user?.id : null,
          notes: notes.trim() || 'Pedido cargado manualmente',
        })
        .select('id')
        .single()

      if (orderError) throw orderError
      if (!orderData?.id) throw new Error('No se pudo crear el pedido.')

      // Insertar notificación para el admin
      if (profile?.role === 'vendedor') {
        await supabase.from('notifications').insert({
          company_id: companyId,
          title: 'Nuevo pedido pendiente',
          message: `El vendedor ha cargado un nuevo pedido para ${selectedClient?.name}.`,
          type: 'new_order',
          link: `/pedidos/${orderData.id}`,
          read: false,
        })
      }

      const orderId = orderData.id

      const itemsToInsert = items.map((item) => ({
        company_id: companyId,
        order_id: orderId,
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        category: item.category,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      toast.success(`Pedido ${orderCode} creado como pendiente.`)
      router.push(`/pedidos/${orderId}`)
    } catch (error) {
      console.error('Error guardando pedido:', error)

      toast.error(
        (error as any)?.message || 'No se pudo guardar el pedido.'
      )
    } finally {
      setSaving(false)
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
            Cargando datos
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            Estamos buscando clientes y productos activos.
          </p>
        </div>
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
            <Link
              href="/pedidos"
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 transition hover:text-white"
            >
              <ArrowLeft size={17} />
              Volver a pedidos
            </Link>

            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <ClipboardList size={14} />
              Nuevo pedido
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Cargar Pedido / Orden de Venta
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Registrá una orden de compra confirmada. Los precios se guardan 
              fijos al momento de la carga.
            </p>
          </div>

          <button
            type="button"
            onClick={saveOrder}
            disabled={!canSave}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}

            {saveButtonText}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <InfoCard
          icon={UserIcon}
          title="Cliente"
          value={selectedClient?.name || 'Sin seleccionar'}
        />

        <InfoCard
          icon={PackageIcon}
          title="Productos"
          value={String(items.length)}
        />

        <InfoCard
          icon={DollarSignIcon}
          title="Total Pedido"
          value={`$${totalAmount.toLocaleString('es-AR')}`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <UserIcon size={22} />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Datos del pedido
                </h2>
                <p className="text-sm font-semibold text-slate-500">
                  Seleccioná el cliente y agregá una nota si corresponde.
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Cliente *
                </label>

                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Seleccionar cliente</option>

                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} - CUIT {client.cuit}
                    </option>
                  ))}
                </select>

                {selectedClient && (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Cliente seleccionado
                    </p>

                    <p className="mt-1 font-black text-slate-950">
                      {selectedClient.name}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <IdCard size={15} />
                        {selectedClient.cuit || '-'}
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <MapPin size={15} />
                        {selectedClient.address || 'Sin dirección'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Notas
                </label>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: entregar en 20 días, revisar cantidades, pedido telefónico..."
                  rows={6}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <PackageIcon size={22} />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Agregar producto del listado
                </h2>
                <p className="text-sm font-semibold text-slate-500">
                  Buscá por código, nombre, categoría o proveedor.
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px]">
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Buscar producto
                </label>

                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Producto
                </label>

                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Cantidad
                </label>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Cant."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />

                  <input
                    type="number"
                    min="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="Precio"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />

                  <button
                    type="button"
                    onClick={addProductItem}
                    className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>

            {selectedProduct && (
              <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50/60 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-blue-500">
                  Producto seleccionado
                </p>

                <h3 className="mt-2 text-xl font-black text-slate-950">
                  {selectedProduct.name}
                </h3>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <SmallInfo
                    icon={Hash}
                    label="Código"
                    value={selectedProduct.internal_code || '-'}
                  />

                  <SmallInfo
                    icon={Tag}
                    label="Categoría"
                    value={selectedProduct.category || '-'}
                  />

                  <SmallInfo
                    icon={Truck}
                    label="Proveedor"
                    value={selectedProduct.supplier || '-'}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-black text-slate-950">
                Agregar producto manual
              </h2>

              <p className="text-sm font-semibold text-slate-500">
                Para productos que no estén cargados en el catálogo.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Código"
                value={manualCode}
                onChange={setManualCode}
                placeholder="Código opcional"
              />

              <InputField
                label="Categoría"
                value={manualCategory}
                onChange={setManualCategory}
                placeholder="Categoría opcional"
              />

              <div className="md:col-span-2">
                <InputField
                  label="Producto *"
                  value={manualName}
                  onChange={setManualName}
                  placeholder="Nombre del producto"
                />
              </div>

              <InputField
                label="Cantidad"
                type="number"
                value={manualQuantity}
                onChange={setManualQuantity}
                placeholder="1"
              />

              <InputField
                label="Precio unitario"
                type="number"
                value={manualPrice}
                onChange={setManualPrice}
                placeholder="0"
              />

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addManualItem}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  <Plus size={18} />
                  Agregar manual
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <ClipboardList size={22} />
                </div>

                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Pedido
                  </h2>

                  <p className="text-sm font-semibold text-slate-500">
                    {items.length} producto{items.length === 1 ? '' : 's'} ·{' '}
                    {totalUnits} unidad{totalUnits === 1 ? '' : 'es'}
                  </p>
                </div>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                  <FileText size={26} />
                </div>

                <h3 className="font-black text-slate-900">
                  Pedido vacío
                </h3>

                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Agregá productos para generar el pedido pendiente.
                </p>
              </div>
            ) : (
              <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
                {items.map((item, index) => (
                  <div key={`${item.product_id || item.product_name}-${index}`} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-black text-slate-950">
                          {item.product_name}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="shrink-0 rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                        aria-label="Quitar producto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(index, e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">
                          Precio
                        </label>
                        <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                          ${item.unit_price.toLocaleString('es-AR')}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-right">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                        Subtotal
                      </p>
                      <p className="text-lg font-black text-blue-700">
                        ${(item.unit_price * item.quantity).toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-200 p-6">
              <button
                type="button"
                onClick={saveOrder}
                disabled={!canSave}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}

                {saveButtonText}
              </button>

              <button
                type="button"
                onClick={() => router.push('/pedidos')}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <p className="mt-3 text-center text-xs font-semibold text-slate-400">
                El pedido quedará registrado como una orden firme.
              </p>
            </div>
          </section>
        </aside>
      </section>
    </div>
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

function SmallInfo({
  icon: Icon,
  label,
  value,
}: {
  icon: any
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
        <Icon size={14} />
        {label}
      </p>

      <p className="mt-1 truncate font-black text-slate-900">
        {value}
      </p>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  )
}