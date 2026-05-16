'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
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
  Zap,
  Loader2,
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
  sale_price: number
}

type BudgetItem = {
  id?: string
  product_id: string | null
  code: string
  name: string
  category: string
  price: number
  quantity: number
  discount_str?: string 
}

export default function EditarPresupuestoPage() {
  const params = useParams()
  const router = useRouter()
  const budgetId = params.id as string

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [cascadingEnabled, setCascadingEnabled] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<BudgetItem[]>([])

  const [clientId, setClientId] = useState('')
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const [productQty, setProductQty] = useState('1')
  const [productPrice, setProductPrice] = useState('')
  const [productDiscount, setProductDiscount] = useState('')

  const [manual, setManual] = useState({
    code: '',
    name: '',
    category: '',
    price: '',
    quantity: '1',
    discount: '',
  })
  const [budgetNotes, setBudgetNotes] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [budgetNumber, setBudgetNumber] = useState<number | null>(null)

  useEffect(() => {
    if (budgetId) loadData()
  }, [budgetId])

  async function getUserContext() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return null

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id, role')
      .eq('id', userData.user.id)
      .single()

    return { 
      companyId: profile?.company_id ?? null,
      role: profile?.role ?? null,
      userId: userData.user.id
    }
  }

  async function loadData() {
    setLoading(true)
    try {
      const context = await getUserContext()
      const currentCompanyId = context?.companyId
      setCompanyId(currentCompanyId || null)

      if (!currentCompanyId) {
        toast.error('No se encontró la empresa del usuario.')
        return
      }

      // 1. Cargar el Presupuesto y sus Ítems
      const { data: budget, error: bError } = await supabase
        .from('budgets')
        .select('*, budget_items(*)')
        .eq('id', budgetId)
        .single()

      if (bError || !budget) throw new Error('Presupuesto no encontrado')
      
      // Bloqueo si ya no es 'issued'
      if (budget.status !== 'issued') {
          toast.warning('Este presupuesto ya no se puede editar.')
          router.push(`/presupuestos/${budgetId}`)
          return
      }

      setBudgetNumber(budget.budget_number)
      setClientId(budget.client_id)
      setBudgetNotes(budget.notes || '')
      
      const mappedItems = budget.budget_items.map((it: any) => ({
        id: it.id,
        product_id: it.product_id,
        code: it.product_code || '',
        name: it.product_name,
        category: it.category || '',
        price: Number(it.unit_price),
        quantity: Number(it.quantity),
        discount_str: it.discount_str || ''
      }))
      setItems(mappedItems)

      // 2. Cargar config de empresa
      const { data: companyData } = await supabase
        .from('companies')
        .select('enable_cascading_discounts')
        .eq('id', currentCompanyId)
        .single()
      
      setCascadingEnabled(companyData?.enable_cascading_discounts ?? false)

      // 3. Cargar Clientes y Productos
      const [clientsRes, productsRes] = await Promise.all([
        supabase.from('clients').select('id, name, cuit').eq('company_id', currentCompanyId).order('name'),
        supabase.from('products').select('id, internal_code, name, category, cost_price, sale_price').eq('company_id', currentCompanyId).eq('show_in_catalog', true).order('name').range(0, 4999)
      ])

      if (clientsRes.data) setClients(clientsRes.data)
      if (productsRes.data) setProducts(productsRes.data)

    } catch (error: any) {
      toast.error(error.message)
      router.push('/presupuestos')
    } finally {
      setLoading(false)
    }
  }

  function calculateCascadingPrice(basePrice: number, discountStr: string): number {
    if (!discountStr.trim()) return basePrice
    const discounts = discountStr.split(/[+\-\s]+/).map(d => parseFloat(d.replace(',', '.'))).filter(d => !isNaN(d) && d !== 0)
    let finalPrice = basePrice
    for (const d of discounts) {
      const clampedD = Math.min(Math.max(d, 0), 100)
      finalPrice = finalPrice * (1 - clampedD / 100)
    }
    return Math.max(0, finalPrice)
  }

  useEffect(() => {
    if (selectedProduct && cascadingEnabled) {
      const basePrice = selectedProduct.sale_price || selectedProduct.cost_price || 0
      const discounted = calculateCascadingPrice(basePrice, productDiscount)
      setProductPrice(discounted.toFixed(2))
    }
  }, [productDiscount, selectedProduct, cascadingEnabled])

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return []
    return products.filter((p) => (
      p.name?.toLowerCase().includes(q) ||
      p.internal_code?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    )).slice(0, 12)
  }, [products, search])

  const selectedClient = clients.find((c) => c.id === clientId)
  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const canSave = Boolean(companyId && clientId && items.length > 0 && !saving)

  function selectProduct(product: Product) {
    setSelectedProduct(product)
    setProductQty('1')
    setProductPrice(String(product.sale_price || product.cost_price || 0))
    setProductDiscount('')
  }

  function addProductItem() {
    if (!selectedProduct) return
    const quantity = Number(productQty)
    const price = Number(productPrice)
    if (!quantity || quantity <= 0 || Number.isNaN(price) || price < 0) {
      toast.error('Datos inválidos')
      return
    }
    setItems((prev) => [...prev, {
      product_id: selectedProduct.id,
      code: selectedProduct.internal_code || '',
      name: selectedProduct.name,
      category: selectedProduct.category || '',
      price,
      quantity,
      discount_str: cascadingEnabled ? productDiscount : undefined
    }])
    setSelectedProduct(null)
    setSearch('')
  }

  function addManualItem() {
    const quantity = Number(manual.quantity)
    let price = Number(manual.price)
    if (!manual.name.trim() || !quantity || quantity <= 0) {
      toast.error('Datos inválidos')
      return
    }
    if (cascadingEnabled && manual.discount.trim()) {
      price = calculateCascadingPrice(price, manual.discount)
    }
    setItems((prev) => [...prev, {
      product_id: null,
      code: manual.code.trim(),
      name: manual.name.trim(),
      category: manual.category.trim(),
      price,
      quantity,
      discount_str: cascadingEnabled ? manual.discount : undefined
    }])
    setManual({ code: '', name: '', category: '', price: '', quantity: '1', discount: '' })
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function updateBudget() {
    if (!canSave) return
    setSaving(true)
    try {
      const { error: bError } = await supabase
        .from('budgets')
        .update({
          client_id: clientId,
          total_amount: total,
          notes: budgetNotes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', budgetId)

      if (bError) throw bError

      await supabase.from('budget_items').delete().eq('budget_id', budgetId)

      const itemsToInsert = items.map((item) => ({
        company_id: companyId,
        budget_id: budgetId,
        product_id: item.product_id,
        product_code: item.code,
        product_name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit_price: item.price,
        discount_str: item.discount_str || null
      }))

      const { error: iError } = await supabase.from('budget_items').insert(itemsToInsert)
      if (iError) throw iError

      toast.success('Presupuesto actualizado correctamente.')
      router.push(`/presupuestos/${budgetId}`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" size={40} /><p className="mt-4 font-bold text-slate-500">Cargando presupuesto...</p></div>

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href={`/presupuestos/${budgetId}`} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 transition hover:text-white">
              <ArrowLeft size={17} /> Volver
            </Link>
            <h1 className="text-3xl font-black tracking-tight">Editar presupuesto #000-{budgetNumber}</h1>
          </div>

          <button
            type="button"
            onClick={updateBudget}
            disabled={!canSave}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Guardar cambios
          </button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-black flex items-center gap-2"><User size={22} className="text-blue-600" /> Cliente</h2>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white transition"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name} - CUIT {client.cuit}</option>
              ))}
            </select>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-black flex items-center gap-2"><Package size={22} className="text-blue-600" /> Agregar producto</h2>
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setSelectedProduct(null); }} placeholder="Buscar producto..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-500 transition" />
            </div>
            
            {search && filteredProducts.length > 0 && !selectedProduct && (
              <div className="mt-3 max-h-72 overflow-auto rounded-2xl border border-slate-200">
                {filteredProducts.map((product) => (
                  <button key={product.id} onClick={() => selectProduct(product)} className="flex w-full items-center justify-between p-4 text-left hover:bg-blue-50 border-b last:border-0 transition">
                    <div><p className="font-black text-slate-950">{product.name}</p><p className="text-xs text-slate-500">{product.internal_code || '-'}</p></div>
                    <p className="font-black text-blue-700">${Number(product.sale_price || 0).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}

            {selectedProduct && (
              <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50/50 p-5">
                <h3 className="text-lg font-black">{selectedProduct.name}</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Field label="Cant." value={productQty} onChange={setProductQty} type="number" />
                    {cascadingEnabled && <Field label="Desc %" value={productDiscount} onChange={setProductDiscount} placeholder="10+5" />}
                    <Field label="Precio" value={productPrice} onChange={setProductPrice} type="number" disabled={cascadingEnabled && !!productDiscount} />
                </div>
                <button onClick={addProductItem} className="mt-5 w-full rounded-2xl bg-blue-600 py-3 text-sm font-black text-white hover:bg-blue-500 transition">Agregar ítem</button>
              </div>
            )}
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
             <h2 className="text-xl font-black mb-4">Notas</h2>
             <textarea value={budgetNotes} onChange={(e) => setBudgetNotes(e.target.value)} rows={6} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none focus:border-blue-500 transition" />
          </section>
        </div>

        <aside className="lg:col-span-2 space-y-6">
          <section className="sticky top-24 rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-black">Resumen</h2>
              <span className="text-sm font-bold text-slate-500">{items.length} ítems</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-auto">
              {items.map((item, idx) => (
                <div key={idx} className="p-5 flex justify-between gap-4 hover:bg-slate-50 transition">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 truncate">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.quantity} x ${item.price.toLocaleString()}</p>
                  </div>
                  <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500 transition"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
            <div className="p-6 bg-slate-900 text-white">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold uppercase opacity-60">Total</span>
                <span className="text-2xl font-black">${total.toLocaleString('es-AR')}</span>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder = '', disabled = false }: any) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase text-slate-400">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold outline-none focus:border-blue-500 disabled:opacity-50" />
    </div>
  )
}
