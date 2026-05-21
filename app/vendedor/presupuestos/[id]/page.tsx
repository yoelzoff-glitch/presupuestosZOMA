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
  User,
  CalendarDays,
  DollarSign,
  Printer,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock3,
  ClipboardList,
  Zap,
  MessageCircle,
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
}

type BudgetItem = {
  id: string
  product_code: string | null
  product_name: string
  category: string | null
  quantity: number
  unit_price: number
  total: number | null
  discount_str: string | null
}

export default function VendedorPresupuestoDetalle() {
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

  useEffect(() => {
    if (id) loadBudget()
  }, [id])

  async function loadBudget() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const { data: userProfile } = await supabase.from('users_profiles').select('role').eq('id', userData.user?.id).single()
    if (userProfile) setRole(userProfile.role || 'vendedor')

    const { data, error } = await supabase.from('budgets').select(`id, company_id, client_id, budget_number, budget_code, budget_date, total_amount, status, seller_id, clients ( name, cuit, address, email, phone )`).eq('id', id).single()

    if (error || !data) {
      toast.error('No se encontró el presupuesto.')
      setLoading(false); return
    }

    setBudget({ ...data, clients: Array.isArray(data.clients) ? data.clients[0] : data.clients } as any)

    const { data: companyData } = await supabase.from('companies').select('*').eq('id', data.company_id).single()
    if (companyData) setCompany(companyData as Company)

    const { data: itemsData } = await supabase.from('budget_items').select('*').eq('budget_id', id).order('created_at', { ascending: true })
    setItems(itemsData || [])

    const { data: orderData } = await supabase.from('orders').select('id').eq('budget_id', id).maybeSingle()
    setAssociatedOrderId(orderData?.id || null)
    setLoading(false)
  }

  async function convertToOrder() {
    if (!budget || !role || associatedOrderId) return
    setConvertingToOrder(true)
    try {
      const nextNumber = await fetchNextNumber('order')

      const { data: orderData, error: oError } = await supabase.from('orders').insert({
        company_id: budget.company_id,
        client_id: budget.client_id,
        budget_id: budget.id,
        order_number: nextNumber,
        order_date: new Date().toISOString(),
        status: role === 'admin' ? 'confirmed' : 'pending',
        seller_id: budget.seller_id
      }).select('id').single()

      if (oError) throw oError

      await supabase.from('order_items').insert(items.map(i => ({
        company_id: budget.company_id,
        order_id: orderData.id,
        product_name: i.product_name,
        product_code: i.product_code,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount_str: i.discount_str
      })))

      await supabase.from('budgets').update({ status: 'approved' }).eq('id', budget.id)
      
      setAssociatedOrderId(orderData.id)
      setBudget(prev => prev ? { ...prev, status: 'approved' } : null)
      toast.success('¡Presupuesto aprobado y convertido a pedido!')
    } catch (err: any) {
      toast.error('Error al convertir: ' + err.message)
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
      if (phone.startsWith('0')) phone = phone.substring(1)
      if (!phone.startsWith('54')) {
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

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" size={40} /></div>
  if (!budget) return <div className="p-20 text-center font-black">Presupuesto no encontrado</div>

  const budgetLabel = budget.budget_code || `000-${budget.budget_number}`

  return (
    <>
      <style jsx global>{`
        #print-section { display: none !important; }
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          nav, aside, header, .no-print, button, .print-hidden, [class*="print:hidden"] { 
            display: none !important; 
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: auto !important;
          }
          #__next, main, .main-content {
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          #print-section { 
            display: block !important; 
            visibility: visible !important; 
            position: absolute !important; 
            top: 0 !important; 
            left: 0 !important; 
            width: 210mm !important; 
            min-height: 297mm !important; 
            background: white !important; 
            padding: 15mm !important; 
            z-index: 9999 !important; 
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* SISTEMA DE ESCALADO INTELIGENTE SEGÚN CANTIDAD DE ÍTEMS */

          /* 1. DENSE LAYOUT (8-10 ítems) */
          #print-section.dense {
            padding: 8mm !important;
          }
          #print-section.dense .pb-6 {
            padding-bottom: 8px !important;
          }
          #print-section.dense .mb-8 {
            margin-bottom: 10px !important;
          }
          #print-section.dense .p-4, #print-section.dense .bg-slate-50 {
            padding: 10px !important;
            margin-bottom: 10px !important;
          }
          #print-section.dense table {
            margin-bottom: 10px !important;
            font-size: 9px !important;
          }
          #print-section.dense table th,
          #print-section.dense table td {
            padding: 5px 6px !important;
          }
          #print-section.dense .text-xl {
            font-size: 1.1rem !important;
          }
          #print-section.dense .text-2xl {
            font-size: 1.25rem !important;
          }
          #print-section.dense .bg-slate-950 {
            padding: 10px !important;
            border-radius: 12px !important;
          }
          #print-section.dense .text-3xl {
            font-size: 1.5rem !important;
          }

          /* 2. ULTRA DENSE LAYOUT (11-15 ítems) */
          #print-section.ultra-dense {
            padding: 6mm !important;
          }
          #print-section.ultra-dense .pb-6 {
            padding-bottom: 4px !important;
          }
          #print-section.ultra-dense .mb-8 {
            margin-bottom: 6px !important;
          }
          #print-section.ultra-dense .p-4, #print-section.ultra-dense .bg-slate-50 {
            padding: 6px !important;
            margin-bottom: 6px !important;
          }
          #print-section.ultra-dense table {
            margin-bottom: 6px !important;
            font-size: 8px !important;
          }
          #print-section.ultra-dense table th,
          #print-section.ultra-dense table td {
            padding: 3px 4px !important;
          }
          #print-section.ultra-dense .text-xl {
            font-size: 0.95rem !important;
          }
          #print-section.ultra-dense .text-2xl {
            font-size: 1.1rem !important;
          }
          #print-section.ultra-dense .bg-slate-950 {
            padding: 6px !important;
            border-radius: 10px !important;
          }
          #print-section.ultra-dense .text-3xl {
            font-size: 1.25rem !important;
          }

          /* 3. SUPER DENSE LAYOUT (16+ ítems) */
          #print-section.super-dense {
            padding: 4mm !important;
          }
          #print-section.super-dense .pb-6 {
            padding-bottom: 2px !important;
          }
          #print-section.super-dense .mb-8 {
            margin-bottom: 4px !important;
          }
          #print-section.super-dense .p-4, #print-section.super-dense .bg-slate-50 {
            padding: 4px !important;
            margin-bottom: 4px !important;
          }
          #print-section.super-dense table {
            margin-bottom: 4px !important;
            font-size: 7px !important;
          }
          #print-section.super-dense table th,
          #print-section.super-dense table td {
            padding: 1.5px 3px !important;
          }
          #print-section.super-dense .text-xl {
            font-size: 0.85rem !important;
          }
          #print-section.super-dense .text-2xl {
            font-size: 0.95rem !important;
          }
          #print-section.super-dense .bg-slate-950 {
            padding: 4px !important;
            border-radius: 8px !important;
          }
          #print-section.super-dense .text-3xl {
            font-size: 1.1rem !important;
          }
        }
      `}</style>

      <div className="space-y-6 pb-20 print:hidden max-w-5xl mx-auto">
        <section className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <Link href="/vendedor/presupuestos" className="inline-flex items-center gap-2 text-blue-400 text-xs font-black uppercase tracking-widest mb-4 hover:text-white transition">
              <ArrowLeft size={16} /> Volver al listado
            </Link>
            <h1 className="text-3xl font-black tracking-tight">Presupuesto {budgetLabel}</h1>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
             <StatusBadge status={budget.status || 'issued'} />
             <button 
                onClick={convertToOrder} 
                disabled={convertingToOrder || !!associatedOrderId || budget.status === 'cancelled'}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 rounded-2xl font-black text-xs transition shadow-lg shadow-blue-900/20"
              >
                {convertingToOrder ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}
                {associatedOrderId ? 'Ya es pedido' : 'Aprobar Pedido'}
              </button>
               <button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 px-5 py-3 rounded-2xl font-black text-xs transition border border-white/10">
                <Printer size={16} className="inline mr-2" /> PDF
              </button>
              <button 
                onClick={handleWhatsAppShare}
                className="bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-2xl font-black text-xs transition shadow-lg shadow-emerald-900/20 flex items-center gap-2"
              >
                <MessageCircle size={16} /> Compartir WhatsApp
              </button>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Cliente</p>
            <p className="font-black text-slate-900">{budget.clients?.name}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Fecha</p>
            <p className="font-black text-slate-900">{new Date(budget.budget_date!).toLocaleDateString()}</p>
          </div>
          <div className="bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-900/10 text-white">
            <p className="text-[10px] font-black uppercase text-blue-200 mb-1">Total</p>
            <p className="text-2xl font-black">${budget.total_amount?.toLocaleString('es-AR')}</p>
          </div>
        </section>

        <section className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            <h3 className="font-black text-slate-900">Items del Presupuesto</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4 text-center">Cant</th>
                  <th className="px-6 py-4 text-right">Unitario</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(item => (
                  <tr key={item.id} className="text-sm">
                    <td className="px-6 py-4">
                      <p className="font-black text-slate-900">{item.product_name}</p>
                      {item.discount_str && <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded inline-flex items-center gap-1 mt-1"><Zap size={8} /> Desc: {item.discount_str}</span>}
                    </td>
                    <td className="px-6 py-4 text-center font-bold">{item.quantity}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-500">${item.unit_price.toLocaleString('es-AR')}</td>
                    <td className="px-6 py-4 text-right font-black text-blue-700">${(item.quantity * item.unit_price).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* PDF PRINT SECTION */}
      <div id="print-section" className={items.length > 15 ? 'super-dense' : items.length > 10 ? 'ultra-dense' : items.length > 7 ? 'dense' : ''}>
        <div className="flex justify-between border-b-2 border-slate-900 pb-6 mb-8">
          <div>
            <h1 className="text-2xl font-black">{company?.name}</h1>
            <p className="text-[10px] font-bold text-slate-500">{company?.address} | {company?.phone}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black uppercase">Presupuesto #{budgetLabel}</h2>
            <p className="text-[10px] font-bold">Fecha: {new Date(budget.budget_date!).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mb-8 p-4 bg-slate-50 rounded-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
          <p className="font-black">{budget.clients?.name}</p>
          <p className="text-[10px] font-bold text-slate-600">CUIT: {budget.clients?.cuit} | {budget.clients?.address}</p>
        </div>

        <table className="w-full text-xs mb-10">
          <thead>
            <tr className="bg-slate-900 text-white"><th className="p-3 text-left">Producto</th><th className="p-3 text-center">Cant</th><th className="p-3 text-right">Unitario</th><th className="p-3 text-right">Subtotal</th></tr>
          </thead>
          <tbody className="border-b border-slate-200">
            {items.map(item => (
              <tr key={item.id} className="border-b last:border-0"><td className="p-3 font-bold">{item.product_name}</td><td className="p-3 text-center">{item.quantity}</td><td className="p-3 text-right">${item.unit_price.toLocaleString()}</td><td className="p-3 text-right font-black">${(item.quantity * item.unit_price).toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>

        <div className="text-right bg-slate-950 text-white p-6 rounded-2xl">
          <p className="text-xs font-black uppercase tracking-widest mb-1">Total a Pagar</p>
          <p className="text-3xl font-black">${budget.total_amount?.toLocaleString('es-AR')}</p>
        </div>
      </div>
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    issued: { label: 'Emitido', icon: Clock3, className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    approved: { label: 'Aprobado', icon: CheckCircle2, className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    cancelled: { label: 'Anulado', icon: XCircle, className: 'bg-red-500/10 text-red-500 border-red-500/20' },
  }
  const config = configs[status] || configs.issued
  return (
    <div className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-xs font-black uppercase tracking-widest ${config.className}`}>
      <config.icon size={16} /> {config.label}
    </div>
  )
}
