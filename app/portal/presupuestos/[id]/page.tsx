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
  Package,
  Printer,
  Loader2,
  XCircle,
  MapPin,
  CheckCircle2,
  Clock,
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
}

export default function PortalPresupuestoDetallePage() {
  const params = useParams()
  const router = useRouter()
  const budgetId = params.id as string

  const [budget, setBudget] = useState<Budget | null>(null)
  const [items, setItems] = useState<BudgetItem[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (budgetId) loadBudget()
  }, [budgetId])

  async function loadBudget() {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/auth/login')
      return
    }

    const { data: customerData } = await supabase
      .from('customer_users')
      .select('company_id, client_id')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (!customerData || !customerData.client_id) {
      setErrorMsg('Usuario no autorizado.')
      setLoading(false)
      return
    }

    const { data: budgetData, error: budgetError } = await supabase
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
        clients (
          name,
          cuit,
          address
        )
      `)
      .eq('id', budgetId)
      .single()

    if (budgetError || !budgetData) {
      console.error('❌ Error cargando presupuesto:', budgetError);
      setErrorMsg(`Presupuesto no encontrado. ID buscado: ${budgetId}. ${budgetError ? 'Error: ' + budgetError.message : ''}`);
      setLoading(false)
      return
    }

    const normalizedBudget = {
      ...budgetData,
      clients: Array.isArray(budgetData.clients) ? budgetData.clients[0] : budgetData.clients
    } as Budget

    const { data: itemsData, error: itemsError } = await supabase
      .from('budget_items')
      .select('id, product_code, product_name, category, quantity, unit_price, total')
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: true })

    if (itemsError) {
      toast.error('Error al cargar los productos del presupuesto.')
    }

    setItems(itemsData || [])
    setLoading(false)
  }

  const calculatedTotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const itemTotal = item.total ?? Number(item.quantity || 0) * Number(item.unit_price || 0)
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
          <p className="mt-1 text-sm font-semibold text-slate-500">Estamos buscando los datos del presupuesto.</p>
        </div>
      </div>
    )
  }

  if (errorMsg || !budget) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
          <XCircle size={28} />
        </div>
        <h2 className="text-xl font-black text-slate-900">Presupuesto no encontrado</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">{errorMsg || 'No pudimos encontrar el presupuesto solicitado.'}</p>
        <Link
          href="/portal/presupuestos"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
        >
          <ArrowLeft size={18} />
          Volver a mis presupuestos
        </Link>
      </div>
    )
  }

  const budgetLabel = budget.budget_code || `000-${budget.budget_number}`
  const isCancelled = budget.status === 'cancelled'

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          html, body { width: 210mm; min-height: 297mm; background: white !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background: white !important; color: #0f172a !important; box-shadow: none !important; border: 0 !important; }
          .print-hidden { display: none !important; }
          .print-card { border: 1px solid #d7dee8 !important; border-radius: 0 !important; box-shadow: none !important; background: white !important; }
          .print-header { display: grid !important; grid-template-columns: 1fr 1fr !important; align-items: start !important; gap: 24px !important; border-bottom: 2px solid #0f172a !important; padding: 0 0 18px 0 !important; margin-bottom: 18px !important; }
          .print-company-logo { max-height: 80px !important; max-width: 220px !important; object-fit: contain !important; margin-bottom: 8px !important; }
          .print-title { font-size: 28px !important; line-height: 1.1 !important; font-weight: 900 !important; color: #0f172a !important; }
          .print-table { width: 100% !important; border-collapse: collapse !important; font-size: 11px !important; }
          .print-table th { background: #f1f5f9 !important; padding: 8px !important; border-bottom: 1px solid #d7dee8 !important; }
          .print-table td { padding: 8px !important; border-bottom: 1px solid #e2e8f0 !important; }
          .print-total { margin-top: 16px !important; margin-left: auto !important; width: 260px !important; border: 2px solid #0f172a !important; padding: 12px !important; }
          
          /* SISTEMA DE IMPRESIÓN COMPACTO INTELIGENTE (PORTAL DE PRESUPUESTOS) */
          
          /* 1. DENSE LAYOUT (8-11 ítems) */
          .print-area.dense {
            border: none !important;
            padding: 4mm !important;
          }
          .print-area.dense .print-header {
            padding-bottom: 10px !important;
            margin-bottom: 12px !important;
            gap: 16px !important;
          }
          .print-area.dense .print-company-logo {
            max-height: 45px !important;
            margin-bottom: 4px !important;
          }
          .print-area.dense .print-title {
            font-size: 22px !important;
          }
          .print-area.dense .p-6, .print-area.dense .p-5 {
            padding: 12px !important;
          }
          .print-area.dense .print-table {
            font-size: 9.5px !important;
          }
          .print-area.dense .print-table th, .print-area.dense .print-table td {
            padding: 6px 8px !important;
          }
          .print-area.dense .print-total {
            padding: 12px !important;
            width: 220px !important;
            border-radius: 14px !important;
            margin-top: 12px !important;
          }
          .print-area.dense .print-total p {
            font-size: 1.6rem !important;
          }
          .print-area.dense .max-w-xl {
            padding: 12px !important;
            border-radius: 14px !important;
          }

          /* 2. ULTRA DENSE LAYOUT (12-17 ítems) */
          .print-area.ultra-dense {
            border: none !important;
            padding: 2mm !important;
          }
          .print-area.ultra-dense .print-header {
            padding-bottom: 8px !important;
            margin-bottom: 10px !important;
            gap: 12px !important;
          }
          .print-area.ultra-dense .print-company-logo {
            max-height: 38px !important;
            margin-bottom: 2px !important;
          }
          .print-area.ultra-dense .print-title {
            font-size: 18px !important;
          }
          .print-area.ultra-dense .p-6, .print-area.ultra-dense .p-5 {
            padding: 8px !important;
          }
          .print-area.ultra-dense .print-table {
            font-size: 8.8px !important;
          }
          .print-area.ultra-dense .print-table th, .print-area.ultra-dense .print-table td {
            padding: 4.5px 6px !important;
          }
          .print-area.ultra-dense .print-total {
            padding: 8px !important;
            width: 180px !important;
            border-radius: 12px !important;
            margin-top: 10px !important;
          }
          .print-area.ultra-dense .print-total p {
            font-size: 1.4rem !important;
          }
          .print-area.ultra-dense .max-w-xl {
            padding: 8px !important;
            border-radius: 12px !important;
          }
          .print-area.ultra-dense .whitespace-pre-line {
            font-size: 8.5px !important;
            line-height: 1.25 !important;
          }

          /* 3. SUPER DENSE LAYOUT (18+ ítems) */
          .print-area.super-dense {
            border: none !important;
            padding: 0 !important;
          }
          .print-area.super-dense .print-header {
            padding-bottom: 4px !important;
            margin-bottom: 8px !important;
            gap: 8px !important;
          }
          .print-area.super-dense .print-company-logo {
            max-height: 32px !important;
            margin-bottom: 1px !important;
          }
          .print-area.super-dense .print-title {
            font-size: 15px !important;
          }
          .print-area.super-dense .p-6, .print-area.super-dense .p-5 {
            padding: 6px !important;
          }
          .print-area.super-dense .print-table {
            font-size: 8px !important;
          }
          .print-area.super-dense .print-table th, .print-area.super-dense .print-table td {
            padding: 3px 5px !important;
          }
          .print-area.super-dense .print-total {
            padding: 6px !important;
            width: 150px !important;
            border-radius: 10px !important;
            margin-top: 8px !important;
          }
          .print-area.super-dense .print-total p {
            font-size: 1.25rem !important;
          }
          .print-area.super-dense .max-w-xl {
            padding: 6px !important;
            border-radius: 10px !important;
          }
          .print-area.super-dense .whitespace-pre-line {
            font-size: 8px !important;
            line-height: 1.15 !important;
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
                href="/portal/presupuestos"
                className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 transition hover:text-white"
              >
                <ArrowLeft size={17} />
                Volver a mis presupuestos
              </Link>

              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
                <FileText size={14} />
                Presupuesto
              </div>

              <h1 className="text-3xl font-black tracking-tight">Presupuesto {budgetLabel}</h1>
              <p className="mt-2 text-sm text-slate-300">
                Revisá el detalle y los productos de este presupuesto.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
              >
                <Printer size={18} />
                Imprimir / PDF
              </button>
            </div>
          </div>
        </section>

        {/* Info cards */}
        <section className="grid gap-4 md:grid-cols-4 print-hidden print:hidden">
          <InfoCard icon={User} title="A nombre de" value={budget.clients?.name || 'Sin nombre'} detail={`CUIT: ${budget.clients?.cuit || '-'}`} />
          <InfoCard icon={CalendarDays} title="Fecha" value={budget.budget_date ? new Date(budget.budget_date).toLocaleDateString('es-AR') : '-'} detail="Fecha de emisión" />
          <InfoCard icon={DollarSign} title="Total" value={`$${finalTotal.toLocaleString('es-AR')}`} detail="Importe presupuestado" />
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                budget.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                budget.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                'bg-blue-50 text-blue-700'
              }`}>
                {budget.status === 'approved' ? <CheckCircle2 size={22} /> :
                 budget.status === 'cancelled' ? <XCircle size={22} /> :
                 <Clock size={22} />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500">Estado</p>
                <p className={`text-lg font-black ${
                  budget.status === 'approved' ? 'text-emerald-700' :
                  budget.status === 'cancelled' ? 'text-red-600' :
                  'text-blue-700'
                }`}>
                  {budget.status === 'approved' ? 'Aprobado' :
                   budget.status === 'cancelled' ? 'Cancelado' :
                   'Emitido'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Document */}
        <section className={`print-area print-card rounded-[1.5rem] border border-slate-200 bg-white shadow-sm ${
          items.length > 17 ? 'super-dense' : items.length > 11 ? 'ultra-dense' : items.length > 7 ? 'dense' : ''
        }`}>
          <div className="print-header border-b border-slate-200 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                {company?.logo_url && (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="print-company-logo mb-4 h-16 object-contain"
                  />
                )}
                <h2 className="print-title text-3xl font-black text-slate-950">
                  {company?.name || 'Presupuesto'}
                </h2>
                <div className="mt-2 space-y-1 text-sm font-bold text-slate-500">
                  {company?.cuit && <p>CUIT: {company.cuit}</p>}
                  {company?.address && <p>{company.address}</p>}
                  {(company?.phone || company?.email) && (
                    <p>
                      {company.phone} {company.phone && company.email ? '·' : ''} {company.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-left md:text-right">
                <p className="print-subtitle text-xs font-black uppercase tracking-[0.25em] text-blue-700">
                  Presupuesto
                </p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">
                  #{budgetLabel}
                </h3>
                <div className="mt-3 flex flex-col gap-1 text-sm font-bold text-slate-500 md:items-end">
                   <p className="flex items-center gap-2">
                     <CalendarDays size={14} />
                     Fecha: {budget.budget_date ? new Date(budget.budget_date).toLocaleDateString('es-AR') : '-'}
                   </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 p-6">
            <h2 className="text-xl font-black text-slate-950">Datos del cliente</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <ClientData icon={User} label="Nombre" value={budget.clients?.name || '-'} />
              <ClientData icon={Hash} label="CUIT" value={budget.clients?.cuit || '-'} />
              <ClientData icon={MapPin} label="Dirección" value={budget.clients?.address || '-'} />
            </div>
          </div>

          <div className="p-6">
            <h2 className="mb-4 text-xl font-black text-slate-950">Productos</h2>

            {items.length === 0 ? (
              <div className="rounded-3xl bg-slate-50 p-10 text-center text-sm font-bold text-slate-500">
                Este presupuesto no tiene productos cargados.
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="print-table-wrap hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
                  <table className="print-table w-full min-w-[700px]">
                    <thead className="bg-slate-50">
                      <tr>
                        <TableHead>Producto</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead align="right">Cantidad</TableHead>
                        <TableHead align="right">Precio unit.</TableHead>
                        <TableHead align="right">Total</TableHead>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => {
                        const itemTotal = item.total ?? Number(item.quantity || 0) * Number(item.unit_price || 0)
                        return (
                          <tr key={item.id} className="transition hover:bg-blue-50/40">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="print-hidden flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 print:hidden">
                                  <Package size={19} />
                                </div>
                                <p className="font-black text-slate-950">{item.product_name}</p>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-slate-600">{item.product_code || '-'}</td>
                            <td className="px-5 py-4 text-slate-600">{item.category || 'Sin categoría'}</td>
                            <td className="px-5 py-4 text-right font-bold text-slate-700">{Number(item.quantity || 0).toLocaleString('es-AR')}</td>
                            <td className="px-5 py-4 text-right font-bold text-slate-700">${Number(item.unit_price || 0).toLocaleString('es-AR')}</td>
                            <td className="px-5 py-4 text-right text-lg font-black text-blue-700">${Number(itemTotal || 0).toLocaleString('es-AR')}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="space-y-3 lg:hidden print-hidden print:hidden">
                  {items.map((item) => {
                    const itemTotal = item.total ?? Number(item.quantity || 0) * Number(item.unit_price || 0)
                    return (
                      <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                            <Package size={20} />
                          </div>
                          <div>
                            <h3 className="font-black text-slate-950">{item.product_name}</h3>
                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              Código: {item.product_code || '-'} · {item.category || 'Sin categoría'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <MiniData label="Cant." value={Number(item.quantity || 0).toLocaleString('es-AR')} />
                          <MiniData label="Precio" value={`$${Number(item.unit_price || 0).toLocaleString('es-AR')}`} />
                          <MiniData label="Total" value={`$${Number(itemTotal || 0).toLocaleString('es-AR')}`} />
                        </div>
                      </article>
                    )
                  })}
                </div>
              </>
            )}

            <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              {company?.default_notes && (
                <div className="max-w-xl rounded-2xl bg-slate-50 p-5">
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                    <Clock size={14} />
                    Notas y condiciones
                  </h4>
                  <p className="whitespace-pre-line text-sm font-medium text-slate-600">
                    {company.default_notes}
                  </p>
                </div>
              )}

              <div className="print-total ml-auto w-full rounded-3xl bg-slate-950 p-6 text-white md:w-96">
                <p className="text-sm font-black uppercase tracking-widest text-blue-200">Total a pagar</p>
                <p className="mt-2 text-4xl font-black">${finalTotal.toLocaleString('es-AR')}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

function InfoCard({ icon: Icon, title, value, detail }: { icon: any; title: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon size={22} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <h2 className="truncate text-xl font-black text-slate-950">{value}</h2>
          <p className="text-xs font-semibold text-slate-400">{detail}</p>
        </div>
      </div>
    </div>
  )
}

function ClientData({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
        <Icon size={14} className="print-hidden print:hidden" />
        {label}
      </p>
      <p className="mt-1 font-black text-slate-900">{value}</p>
    </div>
  )
}

function MiniData({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-900">{value}</p>
    </div>
  )
}

function TableHead({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}
