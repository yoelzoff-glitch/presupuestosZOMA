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
  Hash,
  Tag,
  Package,
  Printer,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock3,
  MapPin,
  Wallet,
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

    if (userProfile) {
      setRole(userProfile.role || 'vendedor')
    }

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
      toast.error(error?.message || 'No se encontró el presupuesto.')
      setLoading(false)
      return
    }

    if (userProfile?.role === 'vendedor' && data.seller_id !== userData.user?.id) {
      toast.error('No tenés permiso para ver este presupuesto.')
      router.push('/presupuestos')
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

    if (companyData) {
      setCompany(companyData as Company)
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('budget_items')
      .select(`
        id,
        product_code,
        product_name,
        category,
        quantity,
        unit_price,
        total,
        discount_str
      `)
      .eq('budget_id', id)
      .order('created_at', { ascending: true })

    if (itemsError) {
      toast.error(itemsError.message)
      setLoading(false)
      return
    }

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
    const { data, error } = await supabase
      .from('orders')
      .select('order_number')
      .eq('company_id', currentCompanyId)
      .order('order_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return (data?.order_number ?? 0) + 1
  }

  async function convertToOrder() {
    if (!budget || !role) return

    if (budget.status === 'cancelled') {
      toast.error('No se puede convertir un presupuesto anulado.')
      return
    }

    if (associatedOrderId) {
      toast.info('Este presupuesto ya fue convertido en pedido.')
      return
    }

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

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError
      setAssociatedOrderId(orderData.id)
      
      const successMsg = role === 'admin' 
        ? '¡Presupuesto convertido a pedido correctamente!' 
        : '¡Pedido solicitado correctamente! El Admin debe aprobarlo.'
      
      toast.success(successMsg)

      if (role === 'vendedor') {
        await supabase.from('notifications').insert({
          company_id: budget.company_id,
          title: 'Nueva solicitud de pedido',
          message: `El vendedor solicitó convertir el presupuesto ${budgetLabel} en pedido.`,
          type: 'new_order',
          link: `/pedidos/${orderData.id}`
        })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error al convertir a pedido.')
    } finally {
      setConvertingToOrder(false)
    }
  }

  const calculatedTotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const itemTotal = item.total ?? (Number(item.quantity || 0) * Number(item.unit_price || 0))
      return acc + Number(itemTotal || 0)
    }, 0)
  }, [items])

  const finalTotal = Number(budget?.total_amount || calculatedTotal || 0)

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
            <Loader2 size={28} className="animate-spin" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Cargando presupuesto</h2>
        </div>
      </div>
    )
  }

  if (!budget) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h2 className="text-xl font-black text-slate-900">Presupuesto no encontrado</h2>
        <Link href="/presupuestos" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white">
          <ArrowLeft size={18} /> Volver
        </Link>
      </div>
    )
  }

  const budgetLabel = budget.budget_code || `000-${budget.budget_number}`

  return (
    <>
      {/* ESTILOS EXCLUSIVOS PARA IMPRESIÓN */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm 15mm;
          }

          html, body {
            width: 210mm;
            height: 297mm;
            background: white !important;
          }

          /* Ocultar TODO lo que no sea el area de impresion */
          body > *:not(#print-root) {
            display: none !important;
          }

          #print-root {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-header {
            display: flex !important;
            justify-content: space-between !important;
            border-bottom: 2px solid #0f172a !important;
            padding-bottom: 20px !important;
            margin-bottom: 25px !important;
          }

          .print-title {
            font-size: 24px !important;
            font-weight: 900 !important;
            color: #0f172a !important;
          }

          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .print-table th {
            background: #0f172a !important;
            color: white !important;
            padding: 10px !important;
            font-size: 10px !important;
            text-transform: uppercase !important;
          }

          .print-table td {
            padding: 10px !important;
            border-bottom: 1px solid #f1f5f9 !important;
            font-size: 10px !important;
          }

          .print-client-box {
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 12px !important;
            padding: 15px !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 20px !important;
            margin-bottom: 20px !important;
          }

          .print-total-card {
            background: #0f172a !important;
            color: white !important;
            padding: 20px !important;
            border-radius: 16px !important;
            text-align: right !important;
            min-width: 200px !important;
          }
        }
      `}</style>

      {/* VISTA DE PANTALLA (App UI) */}
      <div className="space-y-6 print:hidden">
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link href="/presupuestos" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 transition hover:text-white">
                <ArrowLeft size={17} /> Volver a presupuestos
              </Link>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
                <FileText size={14} /> Detalle
              </div>
              <h1 className="text-3xl font-black tracking-tight">Presupuesto {budgetLabel}</h1>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <StatusBadge status={budget.status || 'issued'} />
              <button
                onClick={convertToOrder}
                disabled={convertingToOrder || !!associatedOrderId || budget.status === 'cancelled'}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-blue-500 disabled:opacity-50"
              >
                {convertingToOrder ? <Loader2 size={18} className="animate-spin" /> : <ClipboardList size={18} />}
                {associatedOrderId ? 'Ya es un pedido' : 'Convertir a pedido'}
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-slate-700"
              >
                <Printer size={18} /> Imprimir / PDF
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard icon={User} title="Cliente" value={budget.clients?.name || 'Sin cliente'} detail={`CUIT: ${budget.clients?.cuit || '-'}`} />
          <InfoCard icon={CalendarDays} title="Fecha" value={budget.budget_date ? new Date(budget.budget_date).toLocaleDateString('es-AR') : '-'} detail="Fecha de emisión" />
          <InfoCard icon={DollarSign} title="Total" value={`$${finalTotal.toLocaleString('es-AR')}`} detail="Importe final" />
        </section>

        {/* TABLA UI (Pantalla) */}
        <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-black text-slate-900">Productos presupuestados</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Producto</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 text-center">Cant.</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Precio</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-900">{item.product_name}</div>
                      <div className="text-[10px] font-bold text-slate-400">{item.product_code || '-'}</div>
                      {item.discount_str && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600">
                          <Zap size={10} /> -{item.discount_str}%
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-bold">{item.quantity}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-600">${Number(item.unit_price).toLocaleString('es-AR')}</td>
                    <td className="px-6 py-4 text-right font-black text-blue-600">${(Number(item.quantity) * Number(item.unit_price)).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* VISTA DE IMPRESIÓN (Solo visible al imprimir) */}
      <div id="print-root" className="hidden">
        <div className="print-header">
          <div>
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} style={{ height: '60px' }} />
            ) : (
              <h2 className="text-xl font-black">{company?.name || 'ZOMA TECH'}</h2>
            )}
            <div className="mt-2 text-[10px] text-slate-500 font-bold">
              {company?.cuit && <p>CUIT: {company.cuit}</p>}
              {company?.address && <p>{company.address}</p>}
              <p>{company?.phone} | {company?.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Presupuesto</p>
            <h2 className="print-title">#{budgetLabel}</h2>
            <p className="text-[10px] font-black mt-2">FECHA: {budget.budget_date ? new Date(budget.budget_date).toLocaleDateString('es-AR') : '-'}</p>
          </div>
        </div>

        <div className="print-client-box">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
            <p className="text-xs font-black">{budget.clients?.name}</p>
            <p className="text-xs font-bold text-slate-600 mt-1">CUIT: {budget.clients?.cuit}</p>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dirección / Contacto</p>
            <p className="text-xs font-bold text-slate-600">{budget.clients?.address || 'Sin dirección'}</p>
            <p className="text-xs font-bold text-slate-600 mt-1">{budget.clients?.email || budget.clients?.phone}</p>
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Producto</th>
              <th style={{ textAlign: 'center' }}>Cant.</th>
              <th style={{ textAlign: 'right' }}>Unitario</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="font-black">{item.product_name}</div>
                  {item.discount_str && <div className="text-[8px] font-black text-blue-600">Desc. aplicado: -{item.discount_str}%</div>}
                </td>
                <td style={{ textAlign: 'center' }} className="font-bold">{item.quantity}</td>
                <td style={{ textAlign: 'right' }}>${Number(item.unit_price).toLocaleString('es-AR')}</td>
                <td style={{ textAlign: 'right' }} className="font-black">${(Number(item.quantity) * Number(item.unit_price)).toLocaleString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
          <div style={{ maxWidth: '60%' }}>
            <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Condiciones</p>
            <p className="text-[10px] text-slate-500 italic">{company?.default_notes || 'Válido por 15 días.'}</p>
          </div>
          <div className="print-total-card">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total Final</p>
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