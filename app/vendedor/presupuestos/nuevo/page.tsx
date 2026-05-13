'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  ChevronRight
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
  sale_price: number | null
}

type BudgetItem = {
  product_id: string | null
  code: string
  name: string
  category: string
  price: number
  quantity: number
  discount_str?: string
}

export default function VendedorNuevoPresupuesto() {
  const router = useRouter()
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
  const [budgetNotes, setBudgetNotes] = useState('')

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const clientParam = searchParams?.get('client')

  useEffect(() => {
    if (clientParam && clients.length > 0) {
      setClientId(clientParam)
    }
  }, [clientParam, clients])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id, role')
      .eq('id', userData.user.id)
      .single()

    const cid = profile?.company_id
    setCompanyId(cid || null)
    setRole(profile?.role || 'vendedor')

    if (!cid) {
      toast.error('No se encontró la empresa.')
      setLoading(false)
      return
    }

    const { data: companyData } = await supabase
      .from('companies')
      .select('enable_cascading_discounts, default_notes')
      .eq('id', cid)
      .single()
    
    setCascadingEnabled(companyData?.enable_cascading_discounts ?? false)
    setBudgetNotes(companyData?.default_notes || 'Validez: 15 días.\nPrecios sujetos a cambio.')

    // Cargar clientes (si es vendedor, solo los suyos)
    let clientsQuery = supabase.from('clients').select('id, name, cuit').eq('company_id', cid)
    if (profile?.role === 'vendedor') {
      clientsQuery = clientsQuery.eq('seller_id', userData.user.id)
    }

    const [clientsRes, productsRes] = await Promise.all([
      clientsQuery.order('name', { ascending: true }),
      supabase.from('products').select('*').eq('company_id', cid).order('name', { ascending: true })
    ])

    setClients(clientsRes.data || [])
    setProducts(productsRes.data || [])
    setLoading(false)
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
    return products.filter(p => p.name.toLowerCase().includes(q) || p.internal_code?.toLowerCase().includes(q)).slice(0, 8)
  }, [products, search])

  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0)

  async function saveBudget() {
    if (!clientId || items.length === 0) return
    setSaving(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { data: lastBudget } = await supabase.from('budgets').select('budget_number').eq('company_id', companyId).order('budget_number', { ascending: false }).limit(1).maybeSingle()
      const nextNumber = (lastBudget?.budget_number ?? 1949) + 1

      const { data: budget, error: bError } = await supabase.from('budgets').insert({
        company_id: companyId,
        client_id: clientId,
        budget_number: nextNumber,
        total_amount: total,
        status: 'issued',
        seller_id: role === 'vendedor' ? userData.user?.id : null,
        notes: budgetNotes.trim() || null
      }).select('id').single()

      if (bError) throw bError

      const { error: iError } = await supabase.from('budget_items').insert(
        items.map(i => ({
          company_id: companyId,
          budget_id: budget.id,
          product_id: i.product_id,
          product_code: i.code,
          product_name: i.name,
          category: i.category,
          quantity: i.quantity,
          unit_price: i.price,
          discount_str: i.discount_str || null
        }))
      )
      if (iError) throw iError

      // Enviar notificación al administrador
      try {
        const selectedClient = clients.find(c => c.id === clientId)
        await fetch('/api/notifications/seller-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            budgetId: budget.id,
            budgetCode: `000-${nextNumber}`,
            clientName: selectedClient?.name || 'Cliente'
          })
        })
      } catch (notifErr) {
        console.error('Error enviando notificación al admin:', notifErr)
      }

      toast.success('Presupuesto creado!')
      router.push(`/vendedor/presupuestos/${budget.id}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      <section className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-3xl font-black mb-1">Nuevo Presupuesto</h1>
          <p className="text-slate-400 font-medium">Genera una propuesta comercial en segundos.</p>
        </div>
        <div className="bg-white/10 px-6 py-4 rounded-3xl border border-white/10 text-center min-w-[180px]">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Total Estimado</p>
          <p className="text-2xl font-black text-white">${total.toLocaleString('es-AR')}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {/* CLIENTE */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
              <User size={18} className="text-blue-600" /> Seleccionar Cliente
            </h3>
            <select 
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition"
            >
              <option value="">Buscar cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.cuit})</option>)}
            </select>
          </div>

          {/* BUSCADOR PRODUCTOS */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
              <Package size={18} className="text-blue-600" /> Agregar Productos
            </h3>
            <div className="relative mb-4">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedProduct(null); }}
                placeholder="Nombre o código del producto..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition"
              />
            </div>

            {search && filteredProducts.length > 0 && !selectedProduct && (
              <div className="border border-slate-100 rounded-2xl overflow-hidden mb-4">
                {filteredProducts.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => { 
                      setSelectedProduct(p); 
                      setProductPrice(String(p.sale_price || p.cost_price || 0)); 
                      setProductDiscount(''); 
                    }}
                    className="w-full flex items-center justify-between p-4 hover:bg-blue-50 text-left border-b last:border-0 transition"
                  >
                    <div>
                      <p className="font-black text-slate-900">{p.name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.internal_code || 'S/C'}</p>
                    </div>
                    <p className="font-black text-blue-600">${(p.sale_price || p.cost_price || 0).toLocaleString('es-AR')}</p>
                  </button>
                ))}
              </div>
            )}

            {selectedProduct && (
              <div className="bg-blue-50/50 p-6 rounded-[1.5rem] border border-blue-100 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-black text-slate-900 pr-4">{selectedProduct.name}</h4>
                  <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Cantidad</label>
                    <input type="number" value={productQty} onChange={(e) => setProductQty(e.target.value)} className="w-full rounded-xl border border-blue-100 p-3 text-sm font-bold text-slate-700" />
                  </div>
                  {cascadingEnabled && (
                    <div>
                      <label className="text-[10px] font-black uppercase text-blue-500 mb-1 block flex items-center gap-1"><Zap size={10} /> Descuento (%)</label>
                      <input value={productDiscount} onChange={(e) => setProductDiscount(e.target.value)} placeholder="-10-5" className="w-full rounded-xl border border-blue-200 p-3 text-sm font-black text-blue-700 focus:ring-4 focus:ring-blue-100 outline-none" />
                    </div>
                  )}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Precio Final</label>
                    <div className="w-full rounded-xl bg-white border border-blue-100 p-3 text-sm font-black text-slate-900">
                      ${Number(productPrice).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (cascadingEnabled && productDiscount.trim()) {
                      const discounts = productDiscount.split(/[+\-\s]+/).map(d => parseFloat(d.replace(',', '.'))).filter(d => !isNaN(d))
                      if (discounts.some(d => d > 100)) {
                        toast.error('El descuento no puede ser mayor al 100%.')
                        return
                      }
                    }
                    setItems([...items, { product_id: selectedProduct.id, code: selectedProduct.internal_code || '', name: selectedProduct.name, category: selectedProduct.category || '', price: Number(productPrice), quantity: Number(productQty), discount_str: productDiscount }]);
                    setSelectedProduct(null); setSearch('');
                  }}
                  className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-black text-xs hover:bg-blue-500 transition shadow-lg shadow-blue-900/10"
                >
                  Agregar a la lista
                </button>
              </div>
            )}
          </div>

          {/* CONDICIONES / NOTAS */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" /> Condiciones del Presupuesto
            </h3>
            <p className="text-xs font-semibold text-slate-500 mb-4">
              Estas notas aparecerán al pie del PDF. Podés editarlas para este caso puntual.
            </p>
            <textarea 
              value={budgetNotes}
              onChange={(e) => setBudgetNotes(e.target.value)}
              rows={6}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition resize-none"
              placeholder="Validez, plazos de entrega, formas de pago..."
            />
          </div>
        </div>

        {/* RESUMEN LATERAL */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden sticky top-6">
            <div className="bg-slate-50 p-6 border-b border-slate-100">
              <h3 className="font-black text-slate-900 flex items-center gap-2">
                <Calculator size={18} className="text-blue-600" /> Resumen de Items
              </h3>
            </div>
            
            <div className="p-4 max-h-[400px] overflow-y-auto space-y-3 custom-scrollbar">
              {items.length === 0 ? (
                <p className="text-center py-8 text-slate-400 font-bold italic">No hay productos agregados.</p>
              ) : (
                items.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-2xl relative group border border-slate-100">
                    <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={14} /></button>
                    <p className="text-sm font-black text-slate-900 pr-6">{item.name}</p>
                    <div className="mt-2 flex justify-between items-end">
                      <div className="text-[10px] font-bold text-slate-500">
                        {item.quantity} x ${item.price.toLocaleString('es-AR')}
                        {item.discount_str && <span className="block text-blue-600 font-black"><Zap size={10} className="inline mr-0.5" /> Desc: {item.discount_str}</span>}
                      </div>
                      <p className="text-sm font-black text-slate-900">${(item.quantity * item.price).toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-slate-900 text-white">
              <button 
                onClick={saveBudget}
                disabled={saving || !clientId || items.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black shadow-xl transition flex items-center justify-center gap-3"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                {saving ? 'Guardando...' : 'Confirmar Presupuesto'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
