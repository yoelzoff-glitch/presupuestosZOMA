'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { fetchNextNumber } from '@/lib/fetchNextNumber'
import { toast } from 'sonner'
import {
  ArrowLeft,
  FileText,
  Plus,
  User,
  CalendarDays,
  DollarSign,
  Package,
  Printer,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock3,
  ClipboardList,
  Zap,
  MessageCircle,
  Eye,
} from 'lucide-react'

type Budget = {
  id: string
  company_id: string
  client_id: string
  budget_number: number
  budget_code: string | null
  budget_date: string | null
  total_amount: number | null
  status: string | null
  seller_id: string | null
  notes: string | null
  viewed_at: string | null
  afip_cae?: string | null
  afip_cae_vencimiento?: string | null
  afip_comprobante_numero?: number | null
  afip_comprobante_tipo?: number | null
  clients: {
    name: string
    cuit: string
    address: string | null
    email: string | null
    phone: string | null
  } | null
}

type Company = {
  name: string
  cuit: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  default_notes: string | null
  enable_stock_module: boolean
}

type BudgetItem = {
  id: string
  product_id: string | null
  product_code: string | null
  product_name: string
  category: string | null
  quantity: number
  unit_price: number
  total: number | null
  discount_str: string | null
}

export default function PresupuestoDetallePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [budget, setBudget] = useState<Budget | null>(null)
  const [items, setItems] = useState<BudgetItem[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [convertingToOrder, setConvertingToOrder] = useState(false)
  const [associatedOrderId, setAssociatedOrderId] = useState<string | null>(null)

  // Estados para control de precios actualizados
  const [showPriceAlert, setShowPriceAlert] = useState(false)
  const [priceUpdates, setPriceUpdates] = useState<{
    itemId: string
    name: string
    oldPrice: number
    newPrice: number
  }[]>([])
  const [isCheckingPrices, setIsCheckingPrices] = useState(false)

  // Estados para advertencia de stock
  const [showStockWarningModal, setShowStockWarningModal] = useState(false)
  const [stockWarningMessage, setStockWarningMessage] = useState('')
  const [pendingUseNewPrices, setPendingUseNewPrices] = useState(false)

  useEffect(() => {
    if (id) loadBudget()
  }, [id])

  async function loadBudget() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const { data: userProfile } = await supabase
      .from('users_profiles')
      .select('role')
      .eq('id', userData.user?.id)
      .single()

    if (userProfile) setRole(userProfile.role || 'vendedor')

    const { data, error } = await supabase
      .from('budgets')
      .select(`
        id,
        company_id,
        client_id,
        budget_number,
        budget_code,
        budget_date,
        total_amount,
        status,
        seller_id,
        notes,
        viewed_at,
        clients (
          name,
          cuit,
          address,
          email,
          phone
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      toast.error('No se encontró el presupuesto.')
      setLoading(false)
      return
    }

    const normalizedBudget = {
      ...data,
      clients: Array.isArray(data.clients) ? data.clients[0] : data.clients,
    }
    setBudget(normalizedBudget as Budget)

    const { data: companyData } = await supabase
      .from('companies')
      .select('name, cuit, address, phone, email, website, logo_url, default_notes, enable_stock_module')
      .eq('id', data.company_id)
      .single()

    if (companyData) setCompany(companyData as Company)

    const { data: itemsData } = await supabase
      .from('budget_items')
      .select('id, product_id, product_code, product_name, category, quantity, unit_price, total, discount_str')
      .eq('budget_id', id)
      .order('created_at', { ascending: true })

    setItems(itemsData || [])

    const { data: orderData } = await supabase
      .from('orders')
      .select('id')
      .eq('budget_id', id)
      .maybeSingle()

    setAssociatedOrderId(orderData?.id || null)
    setLoading(false)
  }


  async function handlePasarAPedido() {
    if (!budget || !role || associatedOrderId || budget.status === 'cancelled') return
    
    setIsCheckingPrices(true)
    try {
      const productIds = items.map(i => i.product_id).filter(Boolean) as string[]
      
      if (productIds.length === 0) {
        // Si no hay productos enlazados (ítems manuales), pasamos directo
        convertToOrder()
        return
      }

      const { data: currentProducts } = await supabase
        .from('products')
        .select('id, cost_price')
        .in('id', productIds)

      const updates: typeof priceUpdates = []
      
      items.forEach(item => {
        if (!item.product_id) return
        const current = currentProducts?.find(p => p.id === item.product_id)
        if (current && current.cost_price > item.unit_price) {
          updates.push({
            itemId: item.id,
            name: item.product_name,
            oldPrice: item.unit_price,
            newPrice: current.cost_price
          })
        }
      })

      if (updates.length > 0) {
        setPriceUpdates(updates)
        setShowPriceAlert(true)
      } else {
        convertToOrder()
      }
    } catch (error) {
      console.error(error)
      convertToOrder() // Fallback a conversión normal si falla el chequeo
    } finally {
      setIsCheckingPrices(false)
    }
  }

  async function convertToOrder(useNewPrices: boolean = false, ignoreStockWarning: boolean = false) {
    if (!budget || !role || associatedOrderId) return
    try {
      setConvertingToOrder(true)
      setShowPriceAlert(false)

      // PRE-CHECK DE STOCK (Advertencia si baja de 0, solo para admins que confirman)
      if (company?.enable_stock_module && role === 'admin' && !ignoreStockWarning) {
        let hasWarning = false
        let warningMsg = ''

        const productIds = items.map(i => i.product_id).filter(Boolean) as string[]
        if (productIds.length > 0) {
          const { data: dbProducts } = await supabase
            .from('products')
            .select('id, track_stock, is_bundle, name')
            .in('id', productIds)

          if (dbProducts) {
            for (const item of items) {
              const product = dbProducts.find((p) => p.id === item.product_id)
              
              if (product?.is_bundle) {
                const { data: recipe } = await supabase
                  .from('product_recipes')
                  .select('component_id, quantity')
                  .eq('parent_id', product.id)
                  
                if (recipe && recipe.length > 0) {
                   for (const r of recipe) {
                     const qtyNeeded = Number(item.quantity) * Number(r.quantity)
                     const { data: compProduct } = await supabase.from('products').select('name, stock_quantity, track_stock').eq('id', r.component_id).single()
                     if (compProduct?.track_stock) {
                       const currentStock = compProduct.stock_quantity || 0
                       if (currentStock - qtyNeeded < 0) {
                         hasWarning = true
                         warningMsg = `El stock de "${compProduct.name}" (insumo de ${product.name}) es de ${currentStock} unidades. Quedará en 0 si continuás.`
                         break
                       }
                     }
                   }
                }
              } else if (product?.track_stock) {
                const { data: latestProduct } = await supabase
                  .from('products')
                  .select('stock_quantity')
                  .eq('id', item.product_id)
                  .single()

                const currentStock = latestProduct?.stock_quantity || 0
                if (currentStock - (item.quantity || 0) < 0) {
                  hasWarning = true
                  warningMsg = `El stock de "${item.product_name}" es de ${currentStock} unidades. Quedará en 0 si continuás.`
                }
              }

              if (hasWarning) break
            }
          }
        }

        if (hasWarning) {
          setStockWarningMessage(warningMsg)
          setPendingUseNewPrices(useNewPrices)
          setShowStockWarningModal(true)
          setConvertingToOrder(false)
          return
        }
      }

      const nextOrderNumber = await fetchNextNumber('order')
      
      // Calcular total final si se usan nuevos precios
      let totalToSave = finalTotal
      if (useNewPrices) {
        totalToSave = items.reduce((acc, item) => {
          const update = priceUpdates.find(u => u.itemId === item.id)
          const price = update ? update.newPrice : item.unit_price
          return acc + (Number(item.quantity) * price)
        }, 0)
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          company_id: budget.company_id,
          client_id: budget.client_id,
          budget_id: budget.id,
          order_number: nextOrderNumber,
          order_date: new Date().toISOString(),
          status: role === 'admin' ? 'confirmed' : 'pending',
          source: 'Manual',
          seller_id: budget.seller_id,
          notes: budget.notes || 'Convertido desde presupuesto',
          total_amount: totalToSave
        })
        .select('id')
        .single()

      if (orderError) throw orderError

      const orderItems = items.map((item) => {
        const update = useNewPrices ? priceUpdates.find(u => u.itemId === item.id) : null
        const price = update ? update.newPrice : item.unit_price

        return {
          company_id: budget.company_id,
          order_id: orderData.id,
          product_id: item.product_id, 
          product_code: item.product_code,
          product_name: item.product_name,
          category: item.category,
          quantity: item.quantity,
          unit_price: price,
          discount_str: item.discount_str,
        }
      })
      
      await supabase.from('order_items').insert(orderItems)

      // ACTUALIZAR ESTADO DEL PRESUPUESTO
      const { error: budgetUpdateError } = await supabase
        .from('budgets')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', budget.id)

      if (budgetUpdateError) throw budgetUpdateError
      
      // DESCONTAR STOCK SI EL MÓDULO ESTÁ ACTIVO
      if (company?.enable_stock_module) {
        await subtractStockForOrder(orderData.id, orderItems)
      }

      setAssociatedOrderId(orderData.id)
      setBudget(prev => prev ? { ...prev, status: 'approved' } : null)
      toast.success('¡Convertido a pedido y aprobado!')
    } catch (err: any) {
      console.error(err)
      toast.error('Error al convertir pedido.')
    } finally {
      setConvertingToOrder(false)
    }
  }

  function handleWhatsAppShare() {
    if (!budget) return
    
    const budgetLabel = budget.budget_code || `000-${budget.budget_number}`
    const publicUrl = `${window.location.origin}/p/${budget.id}`
    const message = `¡Hola! Te envío el presupuesto *#${budgetLabel}* de *${company?.name || 'nuestra empresa'}*.\n\nPodés verlo y descargarlo en PDF desde este link:\n${publicUrl}\n\nQuedamos a tu disposición.`
    
    // Normalización del teléfono para Argentina
    let phone = budget.clients?.phone?.replace(/\D/g, '') || ''
    
    if (phone) {
      // Si empieza con 0, se lo sacamos
      if (phone.startsWith('0')) phone = phone.substring(1)
      // Si no tiene el 54 adelante, se lo ponemos
      if (!phone.startsWith('54')) {
        // En Argentina los celulares llevan un 9 después del 54
        // Si el número tiene 10 dígitos (ej: 11 4145...) le ponemos 549
        if (phone.length === 10) {
          phone = '549' + phone
        } else {
          phone = '54' + phone
        }
      }
    }

    const waUrl = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`
    
    window.open(waUrl, '_blank')
  }

  async function subtractStockForOrder(orderId: string, orderItems: any[]) {
    try {
      const productIds = orderItems.map(i => i.product_id).filter(Boolean) as string[]
      if (productIds.length === 0) return

      // 1. Obtener información de los productos (si trackean stock y si son bundles/recetas)
      const { data: products } = await supabase
        .from('products')
        .select('id, track_stock, is_bundle, name')
        .in('id', productIds)

      if (!products) return

      for (const item of orderItems) {
        const product = products.find(p => p.id === item.product_id)
        if (!product) continue

        // Caso A: El producto tiene una RECETA (BOM)
        if (product.is_bundle) {
          const { data: recipe } = await supabase
            .from('product_recipes')
            .select('component_id, quantity')
            .eq('parent_id', product.id)

          if (recipe && recipe.length > 0) {
            for (const r of recipe) {
              const qtyToSubtract = Number(item.quantity) * Number(r.quantity)
              const { data: compProduct } = await supabase.from('products').select('stock_quantity').eq('id', r.component_id).single()
              const currentStock = compProduct?.stock_quantity || 0
              
              const actualSubtracted = Math.min(currentStock, qtyToSubtract)

              if (actualSubtracted > 0) {
                await supabase.rpc('increment_stock', { 
                  row_id: r.component_id, 
                  amount: -actualSubtracted 
                })

                await supabase.from('stock_movements').insert({
                  company_id: budget?.company_id,
                  product_id: r.component_id,
                  type: 'out',
                  quantity: actualSubtracted,
                  reason: 'Venta (Componente)',
                  reference_id: orderId,
                  notes: `Venta de ${product.name} (ID: ${item.order_id}). Cantidad pedida: ${item.quantity}`
                })
              }
            }
          }
        } 
        
        // Caso B: Es un producto simple con track_stock activo
        else if (product.track_stock) {
          const qtyToSubtract = Number(item.quantity)
          const { data: latestProduct } = await supabase.from('products').select('stock_quantity').eq('id', product.id).single()
          const currentStock = latestProduct?.stock_quantity || 0
          
          const actualSubtracted = Math.min(currentStock, qtyToSubtract)

          if (actualSubtracted > 0) {
            await supabase.rpc('increment_stock', { 
              row_id: product.id, 
              amount: -actualSubtracted 
            })

            await supabase.from('stock_movements').insert({
              company_id: budget?.company_id,
              product_id: product.id,
              type: 'out',
              quantity: actualSubtracted,
              reason: 'Venta',
              reference_id: orderId,
              notes: `Pedido #${associatedOrderId || 'Confirmado'}`
            })
          }
        }
      }
    } catch (error) {
      console.error('Error al descontar stock:', error)
      toast.error('Error al actualizar inventario.')
    }
  }

  const calculatedTotal = items.reduce((acc, item) => {
    return acc + (Number(item.quantity || 0) * Number(item.unit_price || 0))
  }, 0)

  const finalTotal = Number(budget?.total_amount || calculatedTotal || 0)

  if (loading) return <div className="p-20 text-center font-black">Cargando...</div>
  if (!budget) return <div className="p-20 text-center font-black">No encontrado</div>

  const budgetLabel = budget.budget_code || `000-${budget.budget_number}`

  return (
    <>
      {/* ESTILOS GLOBALES DE ALTA PRIORIDAD PARA IMPRESIÓN */}
      <style jsx global>{`
        /* Ocultar el bloque de impresion siempre en pantalla */
        #print-section {
          display: none !important;
          visibility: hidden !important;
        }

        @media print {
          @page {
            size: A4;
            margin: 0; /* Quitamos margenes para controlar con padding */
          }

          /* OCULTAR TODO LO QUE NO SEA EL PRESUPUESTO */
          /* Esto apunta a los elementos comunes de layout de la app */
          nav, aside, header, footer, .sidebar, .topbar, .no-print, 
          button, .print-hidden, [class*="print:hidden"] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Asegurar que el body y el html esten limpios */
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: auto !important;
          }

          /* EL CONTENEDOR DE NEXTJS DEBE SER TRANSPARENTE AL FLUJO */
          #__next, main, .main-content {
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }

          /* EL PRESUPUESTO TOMA EL CONTROL */
          #print-section {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 15mm !important;
            background: white !important;
            z-index: 9999 !important;
          }

          /* Forzamos colores de fondo e imagenes para PDF */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* VISTA DE APLICACIÓN (Pantalla) */}
      <div className="space-y-6 print:hidden">
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link href="/presupuestos" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 transition hover:text-white">
                <ArrowLeft size={17} /> Volver  
              </Link>
              <h1 className="text-3xl font-black tracking-tight">Presupuesto {budgetLabel}</h1>
              {budget.viewed_at && (
                <p className="mt-2 flex items-center gap-2 text-sm font-bold text-emerald-400">
                  <Eye size={16} /> Visto por el cliente: {new Date(budget.viewed_at).toLocaleString('es-AR')}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <StatusBadge status={budget.status || 'issued'} />
              <button
                onClick={handlePasarAPedido}
                disabled={convertingToOrder || isCheckingPrices || !!associatedOrderId || budget.status === 'cancelled'}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50 transition active:scale-95 shadow-lg shadow-blue-900/20"
              >
                {convertingToOrder || isCheckingPrices ? <Loader2 size={18} className="animate-spin" /> : <ClipboardList size={18} />}
                {associatedOrderId ? 'Ya es pedido' : 'Pasar a pedido'}
              </button>
              
              <button
                onClick={handleWhatsAppShare}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-500 transition active:scale-95 shadow-lg shadow-emerald-900/20"
              >
                <MessageCircle size={18} /> Compartir WhatsApp
              </button>

              {budget.status === 'issued' && !budget.afip_cae && (
                <Link
                  href={`/presupuestos/${id}/edit`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition active:scale-95 shadow-lg shadow-slate-900/5"
                >
                  <Plus size={18} className="rotate-45" /> Editar
                </Link>
              )}

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-5 py-3 text-sm font-black text-white hover:bg-slate-700 transition active:scale-95 shadow-lg shadow-slate-900/20"
              >
                <Printer size={18} /> Imprimir / PDF
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard icon={User} title="Cliente" value={budget.clients?.name || 'Sin cliente'} detail={`CUIT: ${budget.clients?.cuit || '-'}`} />
          <InfoCard icon={CalendarDays} title="Fecha" value={budget.budget_date ? new Date(budget.budget_date).toLocaleDateString('es-AR') : '-'} detail="Fecha emisión" />
          <InfoCard icon={DollarSign} title="Total" value={`$${finalTotal.toLocaleString('es-AR')}`} detail="Final" />
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Código</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Producto</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Cant.</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Precio U.</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                      {item.product_code || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-black text-slate-900">{item.product_name}</p>
                    {item.discount_str && (
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit mt-1">
                        <Zap size={10} /> -{item.discount_str}%
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center font-bold">{item.quantity}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-600">${Number(item.unit_price).toLocaleString('es-AR')}</td>
                  <td className="px-6 py-4 text-right font-black text-blue-600">${(Number(item.quantity) * Number(item.unit_price)).toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* VISTA DE IMPRESIÓN (PDF) - AISLADA TOTALMENTE */}
      <div id="print-section">
        <div className="flex justify-between border-b-2 border-slate-900 pb-6 mb-8">
          <div>
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" style={{ height: '50px' }} />
            ) : (
              <h1 className="text-xl font-black uppercase">{company?.name || 'ZOMA TECH'}</h1>
            )}
            <div className="text-[10px] font-bold text-slate-500">
              <p>{company?.address}</p>
              <p>CUIT:  {company?.cuit} | {company?.phone}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Presupuesto</p>
            <h2 className="text-2xl font-black">#{budgetLabel}</h2>
            <p className="text-[10px] font-black mt-1 uppercase">Fecha: {budget.budget_date ? new Date(budget.budget_date).toLocaleDateString('es-AR') : '-'}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Datos del Cliente</p>
            <p className="text-xs font-black">{budget.clients?.name}</p>
            <p className="text-[10px] font-bold text-slate-600 mt-1">CUIT: {budget.clients?.cuit || '-'}</p>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Envío / Contacto</p>
            <p className="text-[10px] font-bold text-slate-600 leading-tight">{budget.clients?.address || 'Retira por local'}</p>
            <p className="text-[10px] font-bold text-slate-600 mt-1">{budget.clients?.email || budget.clients?.phone}</p>
          </div>
        </div>

        <table className="w-full border-collapse mb-8 text-[10px]">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-3 text-left uppercase font-black tracking-widest">Código</th>
              <th className="p-3 text-left uppercase font-black tracking-widest">Producto</th>
              <th className="p-3 text-center uppercase font-black tracking-widest">Cant.</th>
              <th className="p-3 text-right uppercase font-black tracking-widest">Precio U.</th>
              <th className="p-3 text-right uppercase font-black tracking-widest">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 border-b border-slate-200">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="p-3 font-bold text-slate-600">{item.product_code || '-'}</td>
                <td className="p-3">
                  <p className="font-black text-slate-950">{item.product_name}</p>
                  {item.discount_str && (
                    <p className="text-[8px] font-black text-blue-600 mt-1">DESCUENTO: -{item.discount_str}%</p>
                  )}
                </td>
                <td className="p-3 text-center font-bold">{item.quantity}</td>
                <td className="p-3 text-right font-bold text-slate-700">${Number(item.unit_price).toLocaleString('es-AR')}</td>
                <td className="p-3 text-right font-black text-slate-950">${(Number(item.quantity) * Number(item.unit_price)).toLocaleString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between items-start pt-4">
          <div className="max-w-[70%]">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1">Condiciones y Observaciones</p>
            <p className="text-[9px] text-slate-600 leading-relaxed whitespace-pre-wrap">{budget.notes || company?.default_notes || 'Validez del presupuesto: 15 días.\nPrecios sujetos a cambio sin previo aviso.'}</p>
          </div>
          <div className="bg-slate-900 text-white p-5 rounded-2xl min-w-[200px] text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Pagar</p>
            <p className="text-3xl font-black">${finalTotal.toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>

      {/* MODAL DE ALERTA DE PRECIOS */}
      {showPriceAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-2xl border border-slate-200">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-6">
              <Zap size={28} />
            </div>

            <h2 className="text-2xl font-black text-slate-950">Detectamos aumentos de precio</h2>
            <p className="mt-2 font-bold text-slate-500 leading-relaxed">
              Algunos productos en este presupuesto tienen precios nuevos en el catálogo. 
              ¿Cómo deseas proceder con el pedido?
            </p>

            <div className="mt-6 max-h-48 overflow-y-auto space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 custom-scrollbar">
              {priceUpdates.map((update, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <p className="text-xs font-black text-slate-700 truncate flex-1">{update.name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 line-through">${update.oldPrice.toLocaleString('es-AR')}</span>
                    <ArrowLeft size={10} className="rotate-180 text-slate-400" />
                    <span className="text-xs font-black text-emerald-600">${update.newPrice.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => convertToOrder(false)}
                disabled={convertingToOrder}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-slate-200 p-4 transition hover:bg-slate-50 active:scale-95"
              >
                <span className="text-sm font-black text-slate-900">Mantener Precios</span>
                <span className="text-[10px] font-bold text-slate-400 mt-1">Respetar presupuesto original</span>
              </button>

              <button
                onClick={() => convertToOrder(true)}
                disabled={convertingToOrder}
                className="flex flex-col items-center justify-center rounded-2xl bg-blue-600 p-4 text-white shadow-xl shadow-blue-900/20 transition hover:bg-blue-500 active:scale-95"
              >
                <span className="text-sm font-black">Actualizar Precios</span>
                <span className="text-[10px] font-bold text-blue-100 mt-1">Usar valores actuales del catálogo</span>
              </button>
            </div>

            <button
              onClick={() => setShowPriceAlert(false)}
              className="mt-4 w-full py-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition"
            >
              Cancelar conversión
            </button>
          </div>
        </div>
      )}

      {/* Modal Advertencia Stock */}
      {showStockWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in zoom-in-95 rounded-[2rem] bg-white p-8 shadow-2xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Package size={32} />
            </div>

            <h3 className="text-center text-2xl font-black text-slate-900">
              ¡Stock Insuficiente!
            </h3>

            <p className="mt-3 text-center font-medium leading-relaxed text-slate-500">
              {stockWarningMessage}
            </p>
            
            <p className="mt-3 text-center text-sm font-black text-slate-700 bg-amber-50 p-3 rounded-xl border border-amber-100">
              El stock no bajará a números negativos. Quedará en cero. ¿Deseas convertir a pedido de todas formas?
            </p>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setShowStockWarningModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowStockWarningModal(false)
                  convertToOrder(pendingUseNewPrices, true)
                }}
                disabled={convertingToOrder}
                className="flex-1 rounded-2xl bg-amber-600 py-3.5 text-sm font-black text-white shadow-lg shadow-amber-900/30 transition hover:bg-amber-500 disabled:opacity-50 inline-flex items-center justify-center"
              >
                {convertingToOrder ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  'Continuar de todos modos'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; icon: any; className: string }> = {
    issued: { label: 'Emitido', icon: Clock3, className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    approved: { label: 'Aprobado', icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    cancelled: { label: 'Anulado', icon: XCircle, className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  }
  const config = configs[status] || configs.issued
  return (
    <div className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-widest ${config.className}`}>
      <config.icon size={16} /> {config.label}
    </div>
  )
}

function InfoCard({ icon: Icon, title, value, detail }: { icon: any; title: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</p>
          <h2 className="truncate text-xl font-black text-slate-950">{value}</h2>
          <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  )
}