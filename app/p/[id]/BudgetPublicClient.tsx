'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  Printer,
  Loader2,
  XCircle,
  CalendarDays,
  User,
  Hash,
  MapPin,
  Package,
} from 'lucide-react'

type Budget = {
  id: string
  company_id: string
  budget_number: number
  budget_code: string | null
  budget_date: string | null
  total_amount: number | null
  notes: string | null
  clients: {
    name: string
    cuit: string
    address: string | null
  } | null
}

type Company = {
  name: string
  cuit: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  default_notes: string | null
}

type BudgetItem = {
  id: string
  product_code: string | null
  product_name: string
  quantity: number
  unit_price: number
  discount_str: string | null
}

export default function BudgetPublicClient() {
  const params = useParams()
  const id = params.id as string

  const [budget, setBudget] = useState<Budget | null>(null)
  const [items, setItems] = useState<BudgetItem[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadPublicData()
  }, [id])

  async function loadPublicData() {
    setLoading(true)
    
    try {
      const res = await fetch(`/api/budgets/public/${id}`)
      if (!res.ok) {
        console.error("Error al cargar presupuesto público:", await res.text())
        setLoading(false)
        return
      }

      const { budget: data, company: companyData, items: itemsData } = await res.json()

      setBudget(data as Budget)
      if (companyData) setCompany(companyData as Company)
      setItems(itemsData || [])

      // Registrar la visita silenciosamente (Fire and forget)
      fetch('/api/budgets/track-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetId: data.id })
      }).catch(e => console.error('Error tracking view:', e))

    } catch (error) {
      console.error("Error en petición:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={40} />
        <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Cargando Presupuesto...</p>
      </div>
    </div>
  )

  if (!budget) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-sm px-6">
        <XCircle className="text-red-500 mx-auto mb-4" size={60} />
        <h1 className="text-2xl font-black text-slate-900">Enlace vencido o inexistente</h1>
        <p className="text-slate-500 mt-2 font-medium">No pudimos encontrar el presupuesto solicitado. Por favor, contactá a la empresa emisora.</p>
      </div>
    </div>
  )

  const budgetLabel = budget.budget_code || `000-${budget.budget_number}`
  const finalTotal = budget.total_amount || 0

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="fixed bottom-8 right-8 z-50 no-print">
        <button
          onClick={() => window.print()}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-900/40 transition hover:bg-blue-500 active:scale-95"
          title="Descargar PDF"
        >
          <Printer size={28} />
        </button>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { 
            box-shadow: none !important; 
            border: none !important; 
            width: 210mm !important;
            padding: 15mm !important;
            margin: 0 !important;
          }

          /* SISTEMA DE IMPRESIÓN COMPACTO INTELIGENTE (VISTA PÚBLICA) */
 
           /* 1. DENSE LAYOUT (8-11 ítems) */
           .print-area.dense {
             padding: 12mm !important;
           }
           .print-area.dense .bg-slate-950 {
             padding: 24px !important;
             border-radius: 18px !important;
           }
           .print-area.dense .bg-slate-950 img {
             height: 45px !important;
             margin-bottom: 8px !important;
           }
           .print-area.dense .bg-slate-950 h2 {
             font-size: 1.6rem !important;
           }
           .print-area.dense .bg-slate-950 h1 {
             font-size: 2.2rem !important;
           }
           .print-area.dense .grid-cols-1 {
             padding: 24px !important;
             gap: 16px !important;
           }
           .print-area.dense .p-0, .print-area.dense .sm:p-6, .print-area.dense .lg:p-12 {
             padding: 12px !important;
           }
           .print-area.dense table {
             font-size: 9.5px !important;
           }
           .print-area.dense table th, .print-area.dense table td {
             padding: 6px 8px !important;
           }
           .print-area.dense table td .shrink-0 {
             display: none !important;
           }
           .print-area.dense .bg-slate-50 {
             padding: 16px !important;
           }
           .print-area.dense .text-5xl {
             font-size: 2rem !important;
           }
 
           /* 2. ULTRA DENSE LAYOUT (12-17 ítems) */
           .print-area.ultra-dense {
             padding: 10mm !important;
           }
           .print-area.ultra-dense .bg-slate-950 {
             padding: 16px !important;
             border-radius: 14px !important;
           }
           .print-area.ultra-dense .bg-slate-950 img {
             height: 38px !important;
             margin-bottom: 4px !important;
           }
           .print-area.ultra-dense .bg-slate-950 h2 {
             font-size: 1.35rem !important;
           }
           .print-area.ultra-dense .bg-slate-950 h1 {
             font-size: 1.8rem !important;
           }
           .print-area.ultra-dense .grid-cols-1 {
             padding: 16px !important;
             gap: 10px !important;
           }
           .print-area.ultra-dense .p-0, .print-area.ultra-dense .sm:p-6, .print-area.ultra-dense .lg:p-12 {
             padding: 8px !important;
           }
           .print-area.ultra-dense table {
             font-size: 8.8px !important;
           }
           .print-area.ultra-dense table th, .print-area.ultra-dense table td {
             padding: 4.5px 6px !important;
           }
           .print-area.ultra-dense table td .shrink-0 {
             display: none !important;
           }
           .print-area.ultra-dense .bg-slate-50 {
             padding: 12px !important;
           }
           .print-area.ultra-dense .text-5xl {
             font-size: 1.5rem !important;
           }
           .print-area.ultra-dense .whitespace-pre-wrap {
             font-size: 8.5px !important;
             line-height: 1.25 !important;
           }
 
           /* 3. SUPER DENSE LAYOUT (18+ ítems) */
           .print-area.super-dense {
             padding: 8mm !important;
           }
           .print-area.super-dense .bg-slate-950 {
             padding: 12px !important;
             border-radius: 10px !important;
           }
           .print-area.super-dense .bg-slate-950 img {
             height: 32px !important;
             margin-bottom: 2px !important;
           }
           .print-area.super-dense .bg-slate-950 h2 {
             font-size: 1.2rem !important;
           }
           .print-area.super-dense .bg-slate-950 h1 {
             font-size: 1.4rem !important;
           }
           .print-area.super-dense .grid-cols-1 {
             padding: 12px !important;
             gap: 8px !important;
           }
           .print-area.super-dense .p-0, .print-area.super-dense .sm:p-6, .print-area.super-dense .lg:p-12 {
             padding: 6px !important;
           }
           .print-area.super-dense table {
             font-size: 8px !important;
           }
           .print-area.super-dense table th, .print-area.super-dense table td {
             padding: 3px 5px !important;
           }
           .print-area.super-dense table td .shrink-0 {
             display: none !important;
           }
           .print-area.super-dense .bg-slate-50 {
             padding: 10px !important;
           }
           .print-area.super-dense .text-5xl {
             font-size: 1.25rem !important;
           }
           .print-area.super-dense .whitespace-pre-wrap {
             font-size: 8px !important;
             line-height: 1.15 !important;
           }
         }
      `}</style>

      <div className="mx-auto max-w-4xl">
        <div className={`print-area bg-white shadow-2xl rounded-[2rem] border border-slate-200 overflow-hidden ${
          items.length > 17 ? 'super-dense' : items.length > 11 ? 'ultra-dense' : items.length > 7 ? 'dense' : ''
        }`}>
          <div className="bg-slate-950 p-8 text-white sm:p-12">
             <div className="flex flex-col sm:flex-row justify-between items-start gap-8">
                <div className="flex-1">
                   {company?.logo_url ? (
                     <img src={company.logo_url} alt={company.name} className="h-16 object-contain mb-6" />
                   ) : (
                     <h2 className="text-3xl font-black mb-2">{company?.name || 'EMPRESA'}</h2>
                   )}
                   <div className="space-y-1 text-sm font-bold text-slate-400">
                      {company?.address && <p className="flex items-center gap-2"><MapPin size={14} /> {company.address}</p>}
                      {company?.phone && <p>Tel: {company.phone}</p>}
                      {company?.email && <p>Email: {company.email}</p>}
                   </div>
                </div>
                <div className="text-left sm:text-right">
                   <span className="inline-block bg-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">Presupuesto</span>
                   <h1 className="text-4xl font-black mb-1">#{budgetLabel}</h1>
                   <p className="text-slate-400 text-sm font-bold">Emitido el {budget.budget_date ? new Date(budget.budget_date).toLocaleDateString('es-AR') : '-'}</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 p-8 sm:p-12 border-b border-slate-100">
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                   <User size={14} /> Cliente
                </p>
                <h3 className="text-xl font-black text-slate-900">{budget.clients?.name}</h3>
                <p className="text-sm font-bold text-slate-500 mt-1">CUIT: {budget.clients?.cuit || '-'}</p>
                <p className="text-sm font-bold text-slate-500">{budget.clients?.address || '-'}</p>
             </div>
             <div className="sm:text-right flex flex-col sm:items-end justify-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total del Presupuesto</p>
                <p className="text-5xl font-black text-blue-600 tracking-tighter">${finalTotal.toLocaleString('es-AR')}</p>
             </div>
          </div>

          <div className="p-0 sm:p-6 lg:p-12 overflow-x-auto">
             <table className="w-full border-collapse">
                <thead>
                   <tr className="border-b-2 border-slate-900 text-left">
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Producto</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 text-center">Cant.</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 text-right">Unitario</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 text-right">Subtotal</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {items.map((item) => (
                      <tr key={item.id} className="group transition hover:bg-slate-50">
                         <td className="px-6 py-6">
                            <div className="flex items-center gap-3">
                               <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                                  <Package size={20} />
                               </div>
                               <div>
                                  <p className="font-black text-slate-900">{item.product_name}</p>
                                  {item.product_code && <p className="text-[10px] font-bold text-slate-400">COD: {item.product_code}</p>}
                               </div>
                            </div>
                         </td>
                         <td className="px-6 py-6 text-center font-bold text-slate-700">{item.quantity}</td>
                         <td className="px-6 py-6 text-right font-bold text-slate-700">${item.unit_price.toLocaleString('es-AR')}</td>
                         <td className="px-6 py-6 text-right font-black text-slate-950">${(item.quantity * item.unit_price).toLocaleString('es-AR')}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>

          <div className="p-8 sm:p-12 bg-slate-50 border-t border-slate-100">
             <div className="flex flex-col lg:flex-row justify-between gap-12">
                <div className="max-w-xl">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                      <Hash size={14} /> Notas y Condiciones
                   </h4>
                   <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {budget.notes || company?.default_notes || 'Validez del presupuesto: 15 días.\nPrecios sujetos a cambio sin previo aviso.'}
                   </p>
                </div>
                <div className="lg:text-right shrink-0">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Importe Final</p>
                   <p className="text-5xl font-black text-slate-950 tracking-tighter">${finalTotal.toLocaleString('es-AR')}</p>
                </div>
             </div>
          </div>
        </div>

        <div className="mt-8 text-center no-print">
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              Generado por <span className="text-blue-600">ZOMA TECH</span>
           </p>
        </div>
      </div>
    </div>
  )
}
