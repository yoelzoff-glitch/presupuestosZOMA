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
  paid_amount: number | null
  status: string | null
  clients: {
    name: string
    cuit: string
    address: string | null
  } | null
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

type PaymentStatus = 'paid' | 'partial' | 'unpaid'

function getPaymentStatus(budget: Budget): PaymentStatus {
  const total = Number(budget.total_amount || 0)
  const paid = Number(budget.paid_amount || 0)
  if (paid >= total && total > 0) return 'paid'
  if (paid > 0 && paid < total) return 'partial'
  return 'unpaid'
}

export default function PortalPresupuestoDetallePage() {
  const params = useParams()
  const router = useRouter()
  const budgetId = params.id as string

  const [budget, setBudget] = useState<Budget | null>(null)
  const [items, setItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (budgetId) loadBudget()
  }, [budgetId])

  async function loadBudget() {
    setLoading(true)

    // Verify user session
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/auth/login')
      return
    }

    // Verify customer belongs to this budget's client
    const { data: customerData } = await supabase
      .from('customer_users')
      .select('company_id, client_id')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (!customerData?.client_id) {
      setErrorMsg('No tenés permiso para ver este presupuesto.')
      setLoading(false)
      return
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
        paid_amount,
        status,
        clients (
          name,
          cuit,
          address
        )
      `)
      .eq('id', budgetId)
      .eq('client_id', customerData.client_id)
      .single()

    if (error || !data) {
      setErrorMsg('No se encontró el presupuesto o no tenés permiso para verlo.')
      setLoading(false)
      return
    }

    const normalizedBudget = {
      ...data,
      clients: Array.isArray(data.clients) ? data.clients[0] : data.clients,
    }

    setBudget(normalizedBudget as Budget)

    // Fetch items
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
  const paymentStatus = budget ? getPaymentStatus(budget) : null

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
          @page { size: A4; margin: 12mm; }
          html, body { width: 210mm; min-height: 297mm; background: white !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background: white !important; color: #0f172a !important; box-shadow: none !important; border: 0 !important; }
          .print-hidden { display: none !important; }
          .print-card { border: 1px solid #d7dee8 !important; border-radius: 0 !important; box-shadow: none !important; background: white !important; }
          .print-header { display: flex !important; justify-content: space-between !important; align-items: flex-start !important; gap: 24px !important; border-bottom: 2px solid #0f172a !important; padding: 0 0 18px 0 !important; margin-bottom: 18px !important; }
          .print-title { font-size: 28px !important; line-height: 1.1 !important; font-weight: 900 !important; color: #0f172a !important; }
          .print-table { width: 100% !important; border-collapse: collapse !important; font-size: 11px !important; }
          .print-table th { background: #f1f5f9 !important; padding: 8px !important; border-bottom: 1px solid #d7dee8 !important; }
          .print-table td { padding: 8px !important; border-bottom: 1px solid #e2e8f0 !important; }
          .print-total { margin-top: 16px !important; margin-left: auto !important; width: 260px !important; border: 2px solid #0f172a !important; padding: 12px !important; }
        }
      `}</style>

      <div className="space-y-6">
        {/* Hero */}
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
                Revisá el detalle de este presupuesto y su estado de pago.
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
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isCancelled ? 'bg-red-50 text-red-600' : paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : paymentStatus === 'partial' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
                {isCancelled ? <XCircle size={22} /> : paymentStatus === 'paid' ? <CheckCircle2 size={22} /> : <Clock size={22} />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500">Estado de pago</p>
                {isCancelled
                  ? <p className="text-lg font-black text-red-600">Anulado</p>
                  : paymentStatus === 'paid'
                    ? <p className="text-lg font-black text-emerald-700">Pagado</p>
                    : paymentStatus === 'partial'
                      ? <p className="text-lg font-black text-yellow-700">Pago parcial</p>
                      : <p className="text-lg font-black text-red-600">Sin pagar</p>
                }
              </div>
            </div>
          </div>
        </section>

        {/* Document */}
        <section className="print-area print-card rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
          <div className="print-header border-b border-slate-200 p-6">
            <div>
              <p className="print-subtitle text-xs font-black uppercase tracking-[0.25em] text-blue-700">Presupuesto</p>
              <h2 className="print-title mt-2 text-3xl font-black text-slate-950">{budgetLabel}</h2>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5 text-left md:text-right">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Fecha de emisión</p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {budget.budget_date ? new Date(budget.budget_date).toLocaleDateString('es-AR') : '-'}
              </p>
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

            <div className="mt-6 flex justify-end">
              <div className="print-total w-full rounded-3xl bg-slate-950 p-6 text-white md:w-96">
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
