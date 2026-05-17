'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Boxes,
  Search,
  RefreshCw,
  AlertTriangle,
  ArrowDownUp,
  History,
  Plus,
  Minus,
  ArrowRight,
  Loader2,
  Package,
  ChevronLeft,
  ChevronRight,
  Filter,
  Lock,
  MessageSquare,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Product = {
  id: string
  name: string
  internal_code: string | null
  stock_quantity: number | null
  min_stock_level: number | null
  track_stock: boolean | null
  category: string | null
  is_bundle: boolean | null
}

type Props = {
  initialProducts: Product[]
  companyId: string
  planType?: string
  enableStockModule?: boolean
}

export default function InventarioClient({ 
  initialProducts, 
  companyId,
  planType = 'base',
  enableStockModule = false,
}: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [filterLowStock, setFilterLowStock] = useState(false)
  const [page, setPage] = useState(1)
  
  // Adjustment Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in')
  const [adjustQty, setAdjustQty] = useState('0')
  const [adjustReason, setAdjustReason] = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [activating, setActivating] = useState(false)

  async function handleActivateStock() {
    setActivating(true)
    try {
      const { error } = await supabase
        .from('companies')
        .update({ enable_stock_module: true })
        .eq('id', companyId)
      if (error) throw error
      toast.success('Módulo de stock activado correctamente!')
      window.location.reload()
    } catch (err: any) {
      toast.error('Error al activar: ' + err.message)
    } finally {
      setActivating(false)
    }
  }

  if (planType === 'base') {
    const messageText = `Hola! Quiero actualizar mi cuenta del Plan BASE al Plan PRO ($110.000/mes) para activar el módulo de Inventario y Control de Stock en ZOMA.`
    const encodedText = encodeURIComponent(messageText)

    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-full animate-pulse" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-slate-950 text-blue-500 shadow-2xl">
            <Boxes size={48} strokeWidth={2.5} />
          </div>
        </div>
        
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-600 text-xs font-black uppercase tracking-widest ring-1 ring-blue-500/20 animate-bounce">
            <Sparkles size={14} /> Función Exclusiva PRO
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border border-slate-200 shadow-sm">
            Tu plan actual: BASE
          </span>
        </div>
        
        <h2 className="text-4xl font-black tracking-tight text-slate-900 mb-4 max-w-lg">
          Controlá tu Stock y Productos al <span className="text-blue-600 underline decoration-blue-600/20 underline-offset-8">máximo.</span>
        </h2>
        
        <p className="max-w-md text-lg font-bold text-slate-500 leading-relaxed mb-6">
          El módulo de Inventario te permite llevar el control físico de stock, alertas críticas y recetas de insumos/productos.
        </p>

        <div className="rounded-3xl bg-blue-50/70 border border-blue-100 p-5 max-w-xs mx-auto shadow-sm mb-10 w-full">
          <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Inversión Plan PRO</p>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-3xl font-black text-slate-900">$110.000</span>
            <span className="text-xs font-bold text-slate-400">/ mes</span>
          </div>
        </div>
        
        <div className="grid gap-6 sm:grid-cols-2 max-w-2xl mb-12 text-left">
          <div className="flex gap-4 p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Boxes size={20}/></div>
            <div>
              <p className="font-black text-slate-900 text-sm">Control Físico de Stock</p>
              <p className="text-xs font-bold text-slate-500 mt-1">Registrá ingresos y egresos de mercadería y controlá niveles mínimos de stock.</p>
            </div>
          </div>
          <div className="flex gap-4 p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><AlertTriangle size={20}/></div>
            <div>
              <p className="font-black text-slate-900 text-sm">Alertas de Stock Crítico</p>
              <p className="text-xs font-bold text-slate-500 mt-1">Recibí notificaciones automáticas cuando tus productos se estén agotando.</p>
            </div>
          </div>
        </div>
 
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={`https://wa.me/5491100000000?text=${encodedText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-8 py-4.5 text-sm font-black text-white shadow-2xl transition-all hover:bg-slate-900 active:scale-95 animate-in fade-in"
          >
            Mejorar mi Plan a PRO
            <ChevronRight size={18} />
          </a>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-4.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Volver al Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!enableStockModule) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-emerald-500/20 blur-[60px] rounded-full animate-pulse" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-slate-950 text-emerald-500 shadow-2xl">
            <Boxes size={48} strokeWidth={2.5} />
          </div>
        </div>
        
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-black uppercase tracking-widest ring-1 ring-emerald-500/20">
            <CheckCircle2 size={14} /> Módulo Incluido en tu Plan
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border border-slate-200 shadow-sm">
            Plan {planType.toUpperCase()}
          </span>
        </div>
        
        <h2 className="text-4xl font-black tracking-tight text-slate-900 mb-4 max-w-lg">
          ¡Tu plan incluye el módulo de Inventario!
        </h2>
        
        <p className="max-w-md text-lg font-bold text-slate-500 leading-relaxed mb-10">
          El módulo de Stock está desactivado en la configuración de tu empresa actual. Habilitalo a continuación con un solo clic para empezar a usarlo inmediatamente.
        </p>
 
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleActivateStock}
            disabled={activating}
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-8 py-4.5 text-sm font-black text-white shadow-2xl hover:bg-emerald-500 transition active:scale-95 disabled:opacity-50"
          >
            {activating ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Activando módulo...
              </>
            ) : (
              <>
                Activar Módulo de Stock Ahora
                <ChevronRight size={18} />
              </>
            )}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-4.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Volver al Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const ITEMS_PER_PAGE = 20

  async function refreshProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('id, name, internal_code, stock_quantity, min_stock_level, track_stock, category, is_bundle')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name')
    
    if (!error && data) setProducts(data)
    setLoading(false)
  }

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        p.internal_code?.toLowerCase().includes(search.toLowerCase())
      
      const isLowStock = (p.stock_quantity || 0) <= (p.min_stock_level || 0)
      const matchesFilter = filterLowStock ? (p.track_stock && isLowStock) : true

      return matchesSearch && matchesFilter
    })
  }, [products, search, filterLowStock])

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredProducts, page])

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)

  const stats = useMemo(() => {
    const tracked = products.filter(p => p.track_stock)
    return {
      total: tracked.length,
      lowStock: tracked.filter(p => (p.stock_quantity || 0) <= (p.min_stock_level || 0)).length,
      outOfStock: tracked.filter(p => (p.stock_quantity || 0) <= 0).length
    }
  }, [products])

  async function handleAdjustStock() {
    if (!selectedProduct || Number(adjustQty) <= 0) return
    setIsAdjusting(true)

    try {
      const quantity = Number(adjustQty)
      const finalQty = adjustType === 'in' ? quantity : -quantity

      // 1. Create movement
      const { error: moveErr } = await supabase.from('stock_movements').insert({
        company_id: companyId,
        product_id: selectedProduct.id,
        type: adjustType === 'in' ? 'in' : 'out',
        quantity: quantity,
        reason: adjustReason || 'Ajuste manual (Módulo Inventario)',
        notes: `Ajuste manual desde panel de inventario`
      })

      if (moveErr) throw moveErr

      // 2. Update product stock (Using RPC would be safer, but let's use standard update for now as we have the current qty)
      const newStock = (selectedProduct.stock_quantity || 0) + finalQty
      const { error: prodErr } = await supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', selectedProduct.id)

      if (prodErr) throw prodErr

      // Update local state
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, stock_quantity: newStock } : p))
      
      toast.success('Stock actualizado correctamente')
      setSelectedProduct(null)
      setAdjustQty('0')
      setAdjustReason('')
    } catch (error: any) {
      toast.error('Error al actualizar: ' + error.message)
    } finally {
      setIsAdjusting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-200">
              <Boxes size={14} />
              Módulo de Stock
            </div>
            <h1 className="text-3xl font-black tracking-tight">Inventario General</h1>
            <p className="mt-1 text-sm text-slate-400">Controlá existencias, niveles mínimos y movimientos de mercadería.</p>
          </div>

          <div className="flex gap-3">
            <Link 
              href="/inventario/movimientos"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-6 py-3 text-sm font-black text-white hover:bg-white/10 transition"
            >
              <History size={18} />
              Historial de Movimientos
            </Link>
            <button 
              onClick={refreshProducts}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Productos Trackeados" value={stats.total} icon={Boxes} color="blue" />
        <StatCard title="Stock Crítico" value={stats.lowStock} icon={AlertTriangle} color="amber" highlight={stats.lowStock > 0} />
        <StatCard title="Sin Stock" value={stats.outOfStock} icon={Minus} color="red" highlight={stats.outOfStock > 0} />
      </div>

      {/* Filters & Table */}
      <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar por nombre o código..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setFilterLowStock(!filterLowStock)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black transition-all ${
                  filterLowStock 
                    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' 
                    : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}
              >
                <Filter size={14} />
                {filterLowStock ? 'Viendo: Stock Crítico' : 'Filtrar Stock Crítico'}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Producto</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Código</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Trackeo</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Stock Actual</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Mínimo</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProducts.map(p => (
                <tr key={p.id} className="group hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.is_bundle ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-tight">{p.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.category || 'Sin categoría'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-slate-500">{p.internal_code || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                      p.track_stock ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${p.track_stock ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {p.track_stock ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StockBadge qty={p.stock_quantity || 0} min={p.min_stock_level || 0} track={p.track_stock || false} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-black text-slate-400">{p.track_stock ? p.min_stock_level : '-'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {p.track_stock && (
                        <button 
                          onClick={() => {
                            setSelectedProduct(p)
                            setAdjustType('in')
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition"
                          title="Ajustar stock"
                        >
                          <ArrowDownUp size={14} />
                        </button>
                      )}
                      <Link 
                        href={`/productos/${p.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-900 hover:text-white transition"
                        title="Ver producto"
                      >
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
            <p className="text-xs font-bold text-slate-500">
              Mostrando página {page} de {totalPages} ({filteredProducts.length} productos)
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-50"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Adjustment Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in zoom-in-95 duration-200 rounded-[2.5rem] border border-white/10 bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-950">Ajustar Stock</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">{selectedProduct.name}</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
                <button 
                  onClick={() => setAdjustType('in')}
                  className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${adjustType === 'in' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Ingreso (+)
                </button>
                <button 
                  onClick={() => setAdjustType('out')}
                  className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${adjustType === 'out' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Egreso (-)
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad</label>
                <input 
                  type="number"
                  autoFocus
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-2xl font-black outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Motivo / Notas</label>
                <textarea 
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Ej: Inventario inicial, devolución, rotura..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white h-24 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAdjustStock}
                  disabled={isAdjusting || Number(adjustQty) <= 0}
                  className={`flex-1 rounded-2xl py-4 text-sm font-black text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 ${
                    adjustType === 'in' ? 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-500' : 'bg-red-600 shadow-red-600/20 hover:bg-red-500'
                  }`}
                >
                  {isAdjusting ? 'Procesando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color, highlight = false }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  }

  return (
    <div className={`rounded-[2rem] border p-6 transition-all ${highlight ? 'shadow-md ring-2 ring-opacity-20 ' + (color === 'amber' ? 'ring-amber-500 bg-amber-50/30' : 'ring-red-500 bg-red-50/30') : 'bg-white shadow-sm'}`}>
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${colors[color]}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</p>
          <h2 className="text-3xl font-black text-slate-950">{value}</h2>
        </div>
      </div>
    </div>
  )
}

function StockBadge({ qty, min, track }: { qty: number, min: number, track: boolean }) {
  if (!track) return <span className="text-xl font-black text-slate-200">∞</span>
  
  const isOutOfStock = qty <= 0
  const isLowStock = qty <= min

  return (
    <div className="flex flex-col items-center">
      <span className={`text-xl font-black ${
        isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-500' : 'text-slate-900'
      }`}>
        {qty}
      </span>
      {isLowStock && (
        <span className={`text-[8px] font-black uppercase tracking-tighter ${isOutOfStock ? 'text-red-500' : 'text-amber-600'}`}>
          {isOutOfStock ? 'Sin stock' : 'Stock Crítico'}
        </span>
      )}
    </div>
  )
}
