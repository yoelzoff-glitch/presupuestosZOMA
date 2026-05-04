'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  FileText,
  Plus,
  Save,
  Search,
  Trash2,
  User,
  Package,
  Hash,
  Tag,
  DollarSign,
  Calculator,
} from 'lucide-react'

type Client = {
  id: string
  name: string
  cuit: string
}

type Product = {
  id: string
  internal_code: string | null
  name: string
  category: string | null
  cost_price: number
}

type BudgetItem = {
  product_id: string | null
  code: string
  name: string
  category: string
  price: number
  quantity: number
}

export default function NuevoPresupuestoPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<BudgetItem[]>([])

  const [clientId, setClientId] = useState('')
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const [productQty, setProductQty] = useState('1')
  const [productPrice, setProductPrice] = useState('')

  const [manual, setManual] = useState({
    code: '',
    name: '',
    category: '',
    price: '',
    quantity: '1',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function getCompanyId() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) return null

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()

    return profile?.company_id ?? null
  }

  async function loadData() {
    setLoading(true)

    const currentCompanyId = await getCompanyId()
    setCompanyId(currentCompanyId)

    if (!currentCompanyId) {
      toast.error('No se encontró la empresa del usuario.')
      setLoading(false)
      return
    }

    const [clientsRes, productsRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, cuit')
        .eq('company_id', currentCompanyId)
        .order('name', { ascending: true }),

      supabase
        .from('products')
        .select('id, internal_code, name, category, cost_price')
        .eq('company_id', currentCompanyId)
        .order('name', { ascending: true })
        .range(0, 4999),
    ])

    if (clientsRes.error) toast.error(clientsRes.error.message)
    if (productsRes.error) toast.error(productsRes.error.message)

    if (clientsRes.data) setClients(clientsRes.data)
    if (productsRes.data) setProducts(productsRes.data)

    setLoading(false)
  }

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim()

    if (!q) return []

    return products
      .filter((p) => {
        return (
          p.name?.toLowerCase().includes(q) ||
          p.internal_code?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        )
      })
      .slice(0, 12)
  }, [products, search])

  const selectedClient = clients.find((c) => c.id === clientId)

  const total = items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  )

  function selectProduct(product: Product) {
    setSelectedProduct(product)
    setProductQty('1')
    setProductPrice(String(product.cost_price || 0))
  }

  function addProductItem() {
    if (!selectedProduct) {
      toast.error('Seleccioná un producto.')
      return
    }

    const quantity = Number(productQty)
    const price = Number(productPrice)

    if (!quantity || quantity <= 0) {
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
        product_id: selectedProduct.id,
        code: selectedProduct.internal_code || '',
        name: selectedProduct.name,
        category: selectedProduct.category || '',
        price,
        quantity,
      },
    ])

    setSelectedProduct(null)
    setSearch('')
    setProductQty('1')
    setProductPrice('')
  }

  function addManualItem() {
    const quantity = Number(manual.quantity)
    const price = Number(manual.price)

    if (!manual.name.trim()) {
      toast.error('Ingresá el nombre del producto.')
      return
    }

    if (!quantity || quantity <= 0) {
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
        code: manual.code.trim(),
        name: manual.name.trim(),
        category: manual.category.trim(),
        price,
        quantity,
      },
    ])

    setManual({
      code: '',
      name: '',
      category: '',
      price: '',
      quantity: '1',
    })
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: 'quantity' | 'price', value: string) {
    const numericValue = Number(value)

    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: Number.isNaN(numericValue) ? 0 : numericValue,
            }
          : item
      )
    )
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

  async function saveBudget() {
    if (!companyId) {
      toast.error('No se encontró la empresa del usuario.')
      return
    }

    if (!clientId) {
      toast.error('Seleccioná un cliente.')
      return
    }

    if (items.length === 0) {
      toast.error('Agregá al menos un producto.')
      return
    }

    setSaving(true)

    try {
      const nextNumber = await getNextBudgetNumber(companyId)

      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          company_id: companyId,
          client_id: clientId,
          budget_number: nextNumber,
          total_amount: total,
          status: 'issued',
        })
        .select('id')
        .single()

      if (budgetError) throw budgetError

      const itemsToInsert = items.map((item) => ({
        company_id: companyId,
        budget_id: budget.id,
        product_id: item.product_id,
        product_code: item.code,
        product_name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit_price: item.price,
      }))

      const { error: itemsError } = await supabase
        .from('budget_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      await supabase.from('account_movements').insert({
        company_id: companyId,
        client_id: clientId,
        budget_id: budget.id,
        movement_type: 'Venta',
        debit: total,
        credit: 0,
        description: `Presupuesto 000-${nextNumber}`,
      })

      toast.success(`Presupuesto 000-${nextNumber} creado correctamente.`)

      setItems([])
      setClientId('')
      setSearch('')
      setSelectedProduct(null)
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar presupuesto.')
    }

    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/presupuestos"
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 transition hover:text-white"
            >
              <ArrowLeft size={17} />
              Volver a presupuestos
            </Link>

            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <FileText size={14} />
              Nuevo presupuesto
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Crear presupuesto
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Seleccioná cliente, agregá productos del listado o cargalos manualmente.
            </p>
          </div>

          <button
            onClick={saveBudget}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 disabled:opacity-60"
          >
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar presupuesto'}
          </button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <User size={22} />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Cliente
                </h2>
                <p className="text-sm text-slate-500">
                  Elegí el cliente para este presupuesto.
                </p>
              </div>
            </div>

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
                <p className="text-sm font-semibold text-slate-500">
                  CUIT: {selectedClient.cuit}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Package size={22} />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Agregar producto del listado
                </h2>
                <p className="text-sm text-slate-500">
                  Buscá por código, nombre o categoría.
                </p>
              </div>
            </div>

            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSelectedProduct(null)
                }}
                placeholder="Buscar producto..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {search && filteredProducts.length > 0 && !selectedProduct && (
              <div className="mt-3 max-h-72 overflow-auto rounded-2xl border border-slate-200">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => selectProduct(product)}
                    className="flex w-full items-center justify-between gap-4 border-b border-slate-100 p-4 text-left transition last:border-b-0 hover:bg-blue-50"
                  >
                    <div>
                      <p className="font-black text-slate-950">
                        {product.name}
                      </p>

                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                        <span>Código: {product.internal_code || '-'}</span>
                        <span>•</span>
                        <span>{product.category || 'Sin categoría'}</span>
                      </div>
                    </div>

                    <p className="shrink-0 font-black text-blue-700">
                      ${Number(product.cost_price || 0).toLocaleString('es-AR')}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {selectedProduct && (
              <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50/50 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-blue-500">
                  Producto seleccionado
                </p>

                <h3 className="mt-2 text-xl font-black text-slate-950">
                  {selectedProduct.name}
                </h3>

                <div className="mt-3 grid gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-3">
                  <Info icon={Hash} label="Código" value={selectedProduct.internal_code || '-'} />
                  <Info icon={Tag} label="Categoría" value={selectedProduct.category || '-'} />
                  <Info
                    icon={DollarSign}
                    label="Precio lista"
                    value={`$${Number(selectedProduct.cost_price || 0).toLocaleString('es-AR')}`}
                  />
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Cantidad"
                    value={productQty}
                    onChange={setProductQty}
                    type="number"
                  />

                  <Field
                    label="Precio unitario"
                    value={productPrice}
                    onChange={setProductPrice}
                    type="number"
                  />

                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-700">
                      Total
                    </label>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-blue-700">
                      ${(Number(productQty || 0) * Number(productPrice || 0)).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>

                <button
                  onClick={addProductItem}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
                >
                  <Plus size={18} />
                  Agregar al presupuesto
                </button>
              </div>
            )}
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-black text-slate-950">
                Agregar producto manual
              </h2>
              <p className="text-sm text-slate-500">
                Para productos que no están cargados en la lista.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Código" value={manual.code} onChange={(v) => setManual({ ...manual, code: v })} />
              <Field label="Categoría" value={manual.category} onChange={(v) => setManual({ ...manual, category: v })} />
              <div className="md:col-span-2">
                <Field label="Producto" value={manual.name} onChange={(v) => setManual({ ...manual, name: v })} />
              </div>
              <Field label="Precio unitario" value={manual.price} onChange={(v) => setManual({ ...manual, price: v })} type="number" />
              <Field label="Cantidad" value={manual.quantity} onChange={(v) => setManual({ ...manual, quantity: v })} type="number" />
            </div>

            <button
              onClick={addManualItem}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              <Plus size={18} />
              Agregar producto manual
            </button>
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-2">
          <section className="sticky top-24 rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Calculator size={22} />
                </div>

                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Carrito
                  </h2>
                  <p className="text-sm text-slate-500">
                    {items.length} productos agregados
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
                  Presupuesto vacío
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Agregá productos para calcular el total.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <div key={index} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          Código: {item.code || '-'} · {item.category || 'Sin categoría'}
                        </p>
                      </div>

                      <button
                        onClick={() => removeItem(index)}
                        className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-black text-slate-500">
                          Cant.
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-black text-slate-500">
                          Precio
                        </label>
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => updateItem(index, 'price', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-right">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                        Total ítem
                      </p>
                      <p className="text-lg font-black text-blue-700">
                        ${(item.price * item.quantity).toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black uppercase tracking-widest text-slate-400">
                  Total
                </p>
                <p className="text-3xl font-black text-slate-950">
                  ${total.toLocaleString('es-AR')}
                </p>
              </div>

              <button
                onClick={saveBudget}
                disabled={saving}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:opacity-60"
              >
                <Save size={18} />
                {saving ? 'Guardando...' : 'Guardar presupuesto'}
              </button>
            </div>
          </section>
        </aside>
      </section>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
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
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  )
}

function Info({
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
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-1 font-black text-slate-800">{value}</p>
    </div>
  )
}