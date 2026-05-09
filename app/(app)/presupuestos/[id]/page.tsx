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
  Phone,
  Mail,
  Globe,
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
  const [alreadyInAccount, setAlreadyInAccount] = useState(false)
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

    // Security check: Vendor can only see their own budgets
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

    // Fetch company data
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

    // Check if there's an associated order
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

      // 1. Create order
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

      // 2. Create order items
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
      const itemTotal =
        item.total ?? Number(item.quantity || 0) * Number(item.unit_price || 0)

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

          <h2 className="text-xl font-black text-slate-900">
            Cargando presupuesto
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            Estamos buscando los datos del presupuesto.
          </p>
        </div>
      </div>
    )
  }

  if (!budget) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
          <XCircle size={28} />
        </div>

        <h2 className="text-xl font-black text-slate-900">
          Presupuesto no encontrado
        </h2>

        <p className="mt-1 text-sm font-semibold text-slate-500">
          No pudimos encontrar el presupuesto solicitado.
        </p>

        <Link
          href="/presupuestos"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
        >
          <ArrowLeft size={18} />
          Volver a presupuestos
        </Link>
      </div>
    )
  }

  const budgetLabel = budget.budget_code || `000-${budget.budget_number}`

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm 15mm;
          }

          html,
          body {
            width: 210mm;
            min-height: 297mm;
            background: white !important;
            overflow: visible !important;
          }

          body * {
            visibility: hidden !important;
          }

          .print-area,
          .print-area * {
            visibility: visible !important;
          }

          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #1e293b !important;
            box-shadow: none !important;
            border: 0 !important;
          }

          .print-hidden {
            display: none !important;
          }

          .print-card {
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }

          .print-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            border-bottom: 2px solid #0f172a !important;
            padding: 0 0 20px 0 !important;
            margin-bottom: 25px !important;
          }

          .print-company-logo {
            max-height: 60px !important;
            max-width: 180px !important;
            object-fit: contain !important;
            margin-bottom: 12px !important;
          }

          .print-title {
            font-size: 24px !important;
            line-height: 1 !important;
            font-weight: 900 !important;
            color: #0f172a !important;
            margin-bottom: 4px !important;
          }

          .print-subtitle {
            font-size: 10px !important;
            letter-spacing: 0.15em !important;
            text-transform: uppercase !important;
            color: #64748b !important;
            font-weight: 900 !important;
          }

          .print-section {
            padding: 0 !important;
            margin-bottom: 25px !important;
          }

          .print-section-title {
            font-size: 14px !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            margin-bottom: 12px !important;
            color: #0f172a !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
          }

          .print-client-box {
            background: #f8fafc !important;
            border-radius: 12px !important;
            padding: 16px !important;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 16px !important;
            border: 1px solid #e2e8f0 !important;
          }

          .print-table-wrap {
            display: block !important;
            overflow: visible !important;
            border: 0 !important;
          }

          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10px !important;
          }

          .print-table th {
            background: #0f172a !important;
            color: white !important;
            font-weight: 900 !important;
            padding: 10px 12px !important;
            text-align: left !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
          }

          .print-table td {
            padding: 12px !important;
            border-bottom: 1px solid #f1f5f9 !important;
            color: #334155 !important;
            vertical-align: top !important;
          }

          .print-total-section {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            margin-top: 30px !important;
            page-break-inside: avoid !important;
          }

          .print-notes {
            max-width: 60% !important;
          }

          .print-total-card {
            background: #0f172a !important;
            color: white !important;
            padding: 20px !important;
            border-radius: 16px !important;
            min-width: 220px !important;
            text-align: right !important;
          }

          .print-total-label {
            font-size: 10px !important;
            letter-spacing: 0.1em !important;
            text-transform: uppercase !important;
            color: #94a3b8 !important;
            font-weight: 900 !important;
          }

          .print-total-amount {
            font-size: 28px !important;
            font-weight: 900 !important;
            margin-top: 4px !important;
          }
        }
      `}</style>

      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl print-hidden print:hidden">
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
                Detalle
              </div>

              <h1 className="text-3xl font-black tracking-tight">
                Presupuesto {budgetLabel}
              </h1>

              <p className="mt-2 text-sm text-slate-300">
                Detalle completo del presupuesto emitido.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <StatusBadge status={budget.status || 'issued'} />

              <button
                type="button"
                onClick={convertToOrder}
                disabled={
                  convertingToOrder ||
                  Boolean(associatedOrderId) ||
                  budget.status === 'cancelled'
                }
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg transition ${associatedOrderId || budget.status === 'cancelled'
                    ? 'cursor-not-allowed bg-slate-500 shadow-slate-900/20'
                    : 'bg-blue-600 shadow-blue-900/30 hover:bg-blue-500'
                  }`}
              >
                {convertingToOrder ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <ClipboardList size={18} />
                )}
                {associatedOrderId
                  ? 'Ya es un pedido'
                  : convertingToOrder
                    ? 'Procesando...'
                    : role === 'admin'
                      ? 'Convertir a pedido'
                      : 'Solicitar Pedido'}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/30 transition hover:bg-slate-700"
              >
                <Printer size={18} />
                Imprimir / PDF
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 print-hidden print:hidden">
          <InfoCard
            icon={User}
            title="Cliente"
            value={budget.clients?.name || 'Sin cliente'}
            detail={`CUIT: ${budget.clients?.cuit || '-'}`}
          />

          <InfoCard
            icon={CalendarDays}
            title="Fecha"
            value={
              budget.budget_date
                ? new Date(budget.budget_date).toLocaleDateString('es-AR')
                : '-'
            }
            detail="Fecha de emisión"
          />

          <InfoCard
            icon={DollarSign}
            title="Total"
            value={`$${finalTotal.toLocaleString('es-AR')}`}
            detail="Importe final"
          />
        </section>

        {/* AREA DE IMPRESIÓN REDISEÑADA */}
        <section className="print-area print-card rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
          <div className="print-header">
            <div>
              {company?.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="print-company-logo"
                />
              ) : (
                <div className="print-company-logo flex items-center gap-2 text-xl font-black text-slate-900">
                  <Package className="text-blue-600" />
                  {company?.name || 'ZOMA TECH'}
                </div>
              )}
              <div className="space-y-0.5 text-[10px] font-bold text-slate-500">
                {company?.cuit && <p>CUIT: {company.cuit}</p>}
                {company?.address && <p>{company.address}</p>}
                <div className="flex gap-3">
                  {company?.phone && <p>{company.phone}</p>}
                  {company?.email && <p>{company.email}</p>}
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="print-subtitle">Presupuesto Comercial</p>
              <h2 className="print-title">#{budgetLabel}</h2>
              <div className="mt-2 text-[10px] font-black text-slate-700">
                FECHA: {budget.budget_date ? new Date(budget.budget_date).toLocaleDateString('es-AR') : '-'}
              </div>
            </div>
          </div>

          <div className="print-section">
            <h2 className="print-section-title">
              <User size={14} className="text-slate-400" />
              Datos del Cliente
            </h2>
            <div className="print-client-box">
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Nombre / Razón Social</p>
                  <p className="text-xs font-black text-slate-900">{budget.clients?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">CUIT / DNI</p>
                  <p className="text-xs font-bold text-slate-700">{budget.clients?.cuit || '-'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dirección de Entrega</p>
                  <p className="text-xs font-bold text-slate-700">{budget.clients?.address || '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Email</p>
                    <p className="text-[10px] font-bold text-slate-700 truncate">{budget.clients?.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Teléfono</p>
                    <p className="text-[10px] font-bold text-slate-700">{budget.clients?.phone || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="print-section">
            <h2 className="print-section-title">
              <Package size={14} className="text-slate-400" />
              Detalle de Productos
            </h2>
            <div className="print-table-wrap">
              <table className="print-table">
                <thead>
                  <tr>
                    <th style={{ width: '45%' }}>Descripción del Producto</th>
                    <th style={{ width: '15%' }}>Código</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Cant.</th>
                    <th style={{ width: '15%', textAlign: 'right' }}>Unitario</th>
                    <th style={{ width: '15%', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const itemTotal = item.total ?? (Number(item.quantity || 0) * Number(item.unit_price || 0))
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="font-black text-slate-900">{item.product_name}</div>
                          {item.discount_str && (
                            <div className="mt-1 flex items-center gap-1 text-[8px] font-black text-blue-600">
                              <Zap size={8} />
                              DESCUENTO APLICADO: -{item.discount_str}%
                            </div>
                          )}
                        </td>
                        <td className="font-bold text-slate-500">{item.product_code || '-'}</td>
                        <td style={{ textAlign: 'center' }} className="font-black">{item.quantity}</td>
                        <td style={{ textAlign: 'right' }} className="font-bold">${Number(item.unit_price).toLocaleString('es-AR')}</td>
                        <td style={{ textAlign: 'right' }} className="font-black text-slate-900">${Number(itemTotal).toLocaleString('es-AR')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="print-total-section">
            <div className="print-notes">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Condiciones Generales</h3>
              <p className="text-[10px] font-medium leading-relaxed text-slate-600 italic">
                {company?.default_notes || 'Este presupuesto tiene una validez de 15 días. Precios sujetos a cambios sin previo aviso.'}
              </p>
            </div>

            <div className="print-total-card">
              <p className="print-total-label">Importe Total Neto</p>
              <h3 className="print-total-amount">${finalTotal.toLocaleString('es-AR')}</h3>
              <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">Impuestos e IVA incluidos</p>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4 py-8 print-hidden md:flex-row md:justify-end">
          <Link
            href="/presupuestos"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
            Volver
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-sm font-black text-white shadow-xl shadow-blue-900/20 transition hover:bg-blue-500"
          >
            <Printer size={18} />
            Imprimir Presupuesto
          </button>
        </div>
      </div>
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<
    string,
    { label: string; icon: any; className: string }
  > = {
    issued: {
      label: 'Emitido',
      icon: Clock3,
      className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    approved: {
      label: 'Aprobado',
      icon: CheckCircle2,
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    cancelled: {
      label: 'Anulado',
      icon: XCircle,
      className: 'bg-red-500/10 text-red-400 border-red-500/20',
    },
  }

  const config = configs[status] || configs.issued

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-widest ${config.className}`}
    >
      <config.icon size={16} />
      {config.label}
    </div>
  )
}

function InfoCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: any
  title: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            {title}
          </p>
          <h2 className="truncate text-xl font-black text-slate-950">
            {value}
          </h2>
          <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
            {detail}
          </p>
        </div>
      </div>
    </div>
  )
}