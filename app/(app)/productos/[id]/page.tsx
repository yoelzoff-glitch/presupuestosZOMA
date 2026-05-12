'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Package,
  Save,
  Tag,
  Truck,
  DollarSign,
  Layers,
  Hash,
  Boxes,
  Plus,
  Trash2,
  AlertTriangle,
  Zap,
  ChevronRight,
  History,
  Settings2,
} from 'lucide-react'

type Product = {
  id: string
  internal_code: string | null
  name: string
  supplier: string | null
  category: string | null
  cost_price: number
  sale_price: number
  stock_quantity: number
  min_stock_level: number
  track_stock: boolean
  is_bundle: boolean
}

type RecipeItem = {
  id: string
  component_id: string
  quantity: number
  component: {
    name: string
    internal_code: string | null
    cost_price: number
  }
}

type CatalogProduct = {
  id: string
  name: string
  internal_code: string | null
  cost_price: number
}

export default function EditarProductoPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'stock' | 'receta'>('general')
  const [enableStockModule, setEnableStockModule] = useState(false)

  const [product, setProduct] = useState<Product | null>(null)
  const [recipe, setRecipe] = useState<RecipeItem[]>([])
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  
  const [searchComponent, setSearchComponent] = useState('')
  const [selectedCompId, setSelectedCompId] = useState('')
  const [compQty, setCompQty] = useState('1')
  
  // States for stock adjustment
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in')
  const [adjustQty, setAdjustQty] = useState('0')
  const [adjustReason, setAdjustReason] = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)

  useEffect(() => {
    if (id) loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const { data: profile } = await supabase
        .from('users_profiles')
        .select('company_id')
        .eq('id', userData.user.id)
        .single()

      if (!profile?.company_id) return

      // Load company settings
      const { data: company } = await supabase
        .from('companies')
        .select('enable_stock_module')
        .eq('id', profile.company_id)
        .single()
      
      setEnableStockModule(company?.enable_stock_module || false)

      // Load product
      const { data: prod, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single()

      if (prodErr || !prod) throw new Error('Producto no encontrado')
      setProduct(prod)

      // Load recipe if exists
      const { data: recData } = await supabase
        .from('product_recipes')
        .select(`
          id,
          component_id,
          quantity,
          component:products!component_id (
            name,
            internal_code,
            cost_price
          )
        `)
        .eq('parent_id', id)
      
      setRecipe((recData as any) || [])

      // Load full catalog for recipe selection
      const { data: catData } = await supabase
        .from('products')
        .select('id, name, internal_code, cost_price')
        .eq('company_id', profile.company_id)
        .eq('active', true)
        .neq('id', id) // Don't include self
        .order('name')
      
      setCatalog(catData || [])

    } catch (error: any) {
      toast.error(error.message)
      router.push('/productos')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!product) return
    setSaving(true)

    try {
      // 1. Update Product
      const { error: prodErr } = await supabase
        .from('products')
        .update({
          internal_code: product.internal_code,
          name: product.name,
          supplier: product.supplier,
          category: product.category,
          cost_price: product.cost_price,
          sale_price: product.sale_price,
          stock_quantity: product.stock_quantity,
          min_stock_level: product.min_stock_level,
          track_stock: product.track_stock,
          is_bundle: recipe.length > 0
        })
        .eq('id', id)

      if (prodErr) throw prodErr

      // 2. Update Recipe (Delete and Re-insert for simplicity in this version)
      await supabase.from('product_recipes').delete().eq('parent_id', id)
      
      if (recipe.length > 0) {
        const recipeToInsert = recipe.map(r => ({
          company_id: (product as any).company_id,
          parent_id: id,
          component_id: r.component_id,
          quantity: r.quantity
        }))
        await supabase.from('product_recipes').insert(recipeToInsert)
      }

      toast.success('Producto actualizado correctamente')
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  function addComponent() {
    if (!selectedCompId) return
    const comp = catalog.find(c => c.id === selectedCompId)
    if (!comp) return

    const exists = recipe.find(r => r.component_id === selectedCompId)
    if (exists) {
      toast.error('Este componente ya está en la receta')
      return
    }

    setRecipe([...recipe, {
      id: Math.random().toString(),
      component_id: selectedCompId,
      quantity: Number(compQty),
      component: {
        name: comp.name,
        internal_code: comp.internal_code,
        cost_price: comp.cost_price
      }
    }])
    setSelectedCompId('')
    setSearchComponent('')
    setCompQty('1')
  }

  async function handleAdjustStock() {
    if (!product || Number(adjustQty) <= 0) return
    setIsAdjusting(true)

    try {
      const quantity = Number(adjustQty)
      const finalQty = adjustType === 'in' ? quantity : -quantity

      // 1. Create movement
      const { error: moveErr } = await supabase.from('inventory_movements').insert({
        company_id: (product as any).company_id,
        product_id: id,
        type: adjustType === 'in' ? 'in' : 'out',
        quantity: quantity,
        reason: adjustReason || 'Ajuste manual',
      })

      if (moveErr) throw moveErr

      // 2. Update product stock
      const newStock = (product.stock_quantity || 0) + finalQty
      const { error: prodErr } = await supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', id)

      if (prodErr) throw prodErr

      setProduct({ ...product, stock_quantity: newStock })
      setShowAdjustModal(false)
      setAdjustQty('0')
      setAdjustReason('')
      toast.success('Stock ajustado correctamente')
    } catch (error: any) {
      toast.error('Error al ajustar stock: ' + error.message)
    } finally {
      setIsAdjusting(false)
    }
  }

  function removeComponent(compId: string) {
    setRecipe(recipe.filter(r => r.component_id !== compId))
  }

  const filteredCatalog = catalog.filter(c => 
    c.name.toLowerCase().includes(searchComponent.toLowerCase()) || 
    c.internal_code?.toLowerCase().includes(searchComponent.toLowerCase())
  ).slice(0, 5)

  if (loading) return <div className="p-20 text-center font-black text-slate-400">Cargando producto...</div>
  if (!product) return null

  const calculatedCost = recipe.reduce((acc, r) => acc + (r.quantity * r.component.cost_price), 0)

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/productos"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">
              {product.name}
            </h1>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                ID: {product.internal_code || 'S/C'}
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {product.category || 'Sin categoría'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar cambios
          </button>
        </div>
      </header>

      <nav className="flex gap-2 rounded-[2rem] bg-slate-100 p-1.5 shadow-inner w-fit">
        <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={Settings2} label="General" />
        {enableStockModule && (
          <>
            <TabButton active={activeTab === 'stock'} onClick={() => setActiveTab('stock')} icon={Boxes} label="Stock e Inventario" />
            <TabButton active={activeTab === 'receta'} onClick={() => setActiveTab('receta')} icon={Layers} label="Insumos / Receta" />
          </>
        )}
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'general' && (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="text-xl font-black text-slate-950 mb-6 flex items-center gap-2">
                <Settings2 size={22} className="text-blue-600" />
                Información del Producto
              </h3>
              
              <div className="grid gap-6 md:grid-cols-2">
                <InputGroup label="Nombre del producto" value={product.name} onChange={v => setProduct({...product, name: v})} icon={Tag} />
                <InputGroup label="Código interno" value={product.internal_code || ''} onChange={v => setProduct({...product, internal_code: v})} icon={Hash} />
                <InputGroup label="Proveedor" value={product.supplier || ''} onChange={v => setProduct({...product, supplier: v})} icon={Truck} />
                <InputGroup label="Categoría" value={product.category || ''} onChange={v => setProduct({...product, category: v})} icon={Layers} />
                <InputGroup label="Precio de venta ($)" type="number" value={(product.sale_price || product.cost_price || 0).toString()} onChange={v => setProduct({...product, sale_price: Number(v)})} icon={DollarSign} />
                <InputGroup label="Precio de costo ($)" type="number" value={(product.cost_price || 0).toString()} onChange={v => setProduct({...product, cost_price: Number(v)})} icon={DollarSign} />
              </div>
            </section>
          )}

          {activeTab === 'stock' && (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-950 flex items-center gap-2">
                  <Boxes size={22} className="text-blue-600" />
                  Control de Inventario
                </h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-sm font-black text-slate-600">Trackear stock</span>
                  <input 
                    type="checkbox" 
                    checked={product.track_stock} 
                    onChange={e => setProduct({...product, track_stock: e.target.checked})}
                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>

              {!product.track_stock ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  <AlertTriangle className="text-amber-400 mb-3" size={40} />
                  <p className="text-slate-500 font-bold max-w-xs text-balance">
                    El seguimiento de stock está desactivado para este producto. No se generarán alertas ni se restará al vender.
                  </p>
                </div>
              ) : (
                <div className="grid gap-8">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-3xl bg-blue-50/50 p-6 border border-blue-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-end gap-3">
                          <span className="text-4xl font-black text-slate-950">{product.stock_quantity}</span>
                          <span className="text-sm font-bold text-slate-400 mb-1">Unidades</span>
                        </div>
                        <button 
                          onClick={() => setShowAdjustModal(true)}
                          className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-blue-600 border border-blue-100 shadow-sm hover:bg-blue-50 transition"
                        >
                          <Plus size={14} />
                          Ajustar
                        </button>
                      </div>
                      <p className="mt-3 text-[10px] font-bold text-blue-400 uppercase tracking-wider leading-tight">
                        Haz clic en "Ajustar" para sumar o restar unidades físicamente.
                      </p>
                    </div>

                    <div className="rounded-3xl bg-slate-50 p-6 border border-slate-100">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Alerta de Stock Crítico</p>
                      <div className="mt-2">
                        <input 
                          type="number" 
                          value={product.min_stock_level}
                          onChange={e => setProduct({...product, min_stock_level: Number(e.target.value)})}
                          className="w-full text-2xl font-black bg-transparent outline-none border-b-2 border-slate-200 focus:border-blue-500 transition"
                        />
                        <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Te avisaremos cuando el stock baje de este valor.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === 'receta' && (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="text-xl font-black text-slate-950 mb-2 flex items-center gap-2">
                <Zap size={22} className="text-amber-500" />
                Insumos Asociados (Receta)
              </h3>
              <p className="text-sm font-bold text-slate-500 mb-8">
                Define qué componentes descuentan stock cuando vendes este producto.
              </p>

              <div className="space-y-6">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input 
                      placeholder="Buscar insumo por nombre o código..."
                      value={searchComponent}
                      onChange={e => setSearchComponent(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white"
                    />
                    {searchComponent && filteredCatalog.length > 0 && (
                      <div className="absolute left-0 top-full z-10 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                        {filteredCatalog.map(item => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setSelectedCompId(item.id)
                              setSearchComponent(item.name)
                            }}
                            className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50 transition"
                          >
                            <span className="text-xs font-black">{item.name}</span>
                            <span className="text-[10px] font-bold text-slate-400">{item.internal_code || 'S/C'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input 
                    type="number"
                    value={compQty}
                    onChange={e => setCompQty(e.target.value)}
                    className="w-20 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-center text-sm font-black outline-none focus:border-blue-500"
                  />
                  <button 
                    onClick={addComponent}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <div className="divide-y divide-slate-100 rounded-3xl border border-slate-100 overflow-hidden">
                  {recipe.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 font-bold text-sm">
                      No hay insumos cargados para este producto.
                    </div>
                  ) : (
                    recipe.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-4 bg-slate-50/30">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm text-slate-400">
                            <Hash size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{r.component.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.component.internal_code || 'S/C'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs font-black text-slate-900">x {r.quantity}</p>
                            <p className="text-[10px] font-bold text-slate-400">Cant. necesaria</p>
                          </div>
                          <button 
                            onClick={() => removeComponent(r.component_id)}
                            className="text-slate-300 hover:text-red-500 transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-lg font-black text-slate-950 mb-6 flex items-center gap-2">
              <History size={20} className="text-slate-400" />
              Resumen Financiero
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50">
                <span className="text-xs font-bold text-slate-500">Costo Base</span>
                <span className="text-sm font-black text-slate-900">${product.cost_price.toLocaleString('es-AR')}</span>
              </div>
              
              {recipe.length > 0 && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                  <span className="text-xs font-bold text-blue-600">Costo Insumos</span>
                  <span className="text-sm font-black text-blue-700">${calculatedCost.toLocaleString('es-AR')}</span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Costo Total Estimado</span>
                  <span className="text-xl font-black text-slate-950">${(product.cost_price + calculatedCost).toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
            <h3 className="text-lg font-black mb-4 relative z-10">Ayuda PRO</h3>
            <p className="text-xs font-medium text-slate-400 leading-relaxed relative z-10">
              Si este producto es un **ensamblado** (como una bañera), asegúrate de cargar todos sus componentes en la pestaña "Insumos". 
              El sistema se encargará de calcular el costo real basándose en los precios de los componentes.
            </p>
          </section>
        </aside>
      </div>

      <StockAdjustModal 
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        onConfirm={handleAdjustStock}
        type={adjustType}
        setType={setAdjustType}
        qty={adjustQty}
        setQty={setAdjustQty}
        reason={adjustReason}
        setReason={setAdjustReason}
        loading={isAdjusting}
      />
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-[1.5rem] px-5 py-2.5 text-xs font-black transition-all ${
        active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

function InputGroup({ label, value, onChange, icon: Icon, type = 'text' }: { label: string, value: string, onChange: (v: string) => void, icon: any, type?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-black text-slate-700 ml-1">{label}</label>
      <div className="relative">
        <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-10 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white"
        />
      </div>
    </div>
  )
}

function Loader2({ size, className }: { size: number, className: string }) {
  return <History size={size} className={className} /> // Just a placeholder loader
}

function StockAdjustModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  type, 
  setType, 
  qty, 
  setQty, 
  reason, 
  setReason,
  loading 
}: any) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md animate-in zoom-in-95 duration-200 rounded-[2.5rem] border border-white/10 bg-white p-8 shadow-2xl lg:p-10">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-2xl font-black text-slate-950">Ajustar Stock</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Plus size={24} className="rotate-45" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
            <button 
              onClick={() => setType('in')}
              className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${type === 'in' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Ingreso (+)
            </button>
            <button 
              onClick={() => setType('out')}
              className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${type === 'out' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Egreso (-)
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad</label>
            <input 
              type="number"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-2xl font-black outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Motivo / Notas</label>
            <textarea 
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ej: Carga inicial, rotura, devolución..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white h-24 resize-none"
            />
          </div>

          <button
            onClick={onConfirm}
            disabled={loading || Number(qty) <= 0}
            className={`w-full rounded-2xl py-4 text-sm font-black text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 ${
              type === 'in' ? 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-500' : 'bg-red-600 shadow-red-600/20 hover:bg-red-500'
            }`}
          >
            {loading ? 'Procesando...' : 'Confirmar Ajuste'}
          </button>
        </div>
      </div>
    </div>
  )
}
