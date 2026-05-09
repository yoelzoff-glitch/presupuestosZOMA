'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  FileText,
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
      .select('name, cuit, address, phone, email, website, logo_url, default_notes')
      .eq('id', data.company_id)
      .single()

    if (companyData) setCompany(companyData as Company)

    const { data: itemsData } = await supabase
      .from('budget_items')
      .select('id, product_code, product_name, category, quantity, unit_price, total, discount_str')
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

  async function getNextOrderNumber(currentCompanyId: string) {
    const { data } = await supabase
      .from('orders')
      .select('order_number')
      .eq('company_id', currentCompanyId)
      .order('order_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data?.order_number ?? 0) + 1
  }

  async function convertToOrder() {
    if (!budget || !role || associatedOrderId) return
    try {
      setConvertingToOrder(true)
      const nextOrderNumber = await getNextOrderNumber(budget.company_id)
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
          seller_id: budget.seller_id
        })
        .select('id')
        .single()
      if (orderError) throw orderError

      const orderItems = items.map((item) => ({
        company_id: budget.company_id,
        order_id: orderData.id,
        product_id: null, 
        product_code: item.product_code,
        product_name: item.product_name,
        category: item.category,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_str: item.discount_str,
      }))
      await supabase.from('order_items').insert(orderItems)
      setAssociatedOrderId(orderData.id)
      toast.success('Pedido generado.')
    } catch (err: any) {
      toast.error('Error.')
    } finally {
      setConvertingToOrder(false)
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
            </div>

            <div className="flex gap-3">
              <StatusBadge status={budget.status || 'issued'} />
              <button
                onClick={convertToOrder}
                disabled={convertingToOrder || !!associatedOrderId || budget.status === 'cancelled'}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {convertingToOrder ? <Loader2 size={18} className="animate-spin" /> : <ClipboardList size={18} />}
                {associatedOrderId ? 'Ya es pedido' : 'Pasar a pedido'}
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-5 py-3 text-sm font-black text-white hover:bg-slate-700"
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
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Producto</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Cant.</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Unitario</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
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
              <p>CUIT: {company?.cuit} | {company?.phone}</p>
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
              <th className="p-3 text-left uppercase font-black tracking-widest">Descripción</th>
              <th className="p-3 text-center uppercase font-black tracking-widest">Cant.</th>
              <th className="p-3 text-right uppercase font-black tracking-widest">Unitario</th>
              <th className="p-3 text-right uppercase font-black tracking-widest">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 border-b border-slate-200">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
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
          <div className="max-w-[60%]">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Observaciones</p>
            <p className="text-[9px] text-slate-500 italic leading-relaxed">{company?.default_notes || 'Validez: 15 días.'}</p>
          </div>
          <div className="bg-slate-900 text-white p-5 rounded-2xl min-w-[200px] text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Pagar</p>
            <p className="text-3xl font-black">${finalTotal.toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>
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