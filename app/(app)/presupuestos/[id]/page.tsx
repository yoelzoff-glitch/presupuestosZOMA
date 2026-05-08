'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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

export default function PresupuestoDetallePage() {
  const params = useParams()
  const id = params.id as string

  const [budget, setBudget] = useState<Budget | null>(null)
  const [items, setItems] = useState<BudgetItem[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingToAccount, setSendingToAccount] = useState(false)
  const [convertingToOrder, setConvertingToOrder] = useState(false)
  const [alreadyInAccount, setAlreadyInAccount] = useState(false)
  const [associatedOrderId, setAssociatedOrderId] = useState<string | null>(null)

  useEffect(() => {
    if (id) loadBudget()
  }, [id])

  async function loadBudget() {
    setLoading(true)

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
        clients (
          name,
          cuit,
          address
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      toast.error(error.message)
      setLoading(false)
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

    const { data: movementData, error: movementError } = await supabase
      .from('account_movements')
      .select('id')
      .eq('budget_id', data.id)
      .eq('movement_type', 'Venta')
      .maybeSingle()

    if (movementError) {
      toast.error(movementError.message)
      setLoading(false)
      return
    }

    setAlreadyInAccount(!!movementData)

    const { data: itemsData, error: itemsError } = await supabase
      .from('budget_items')
      .select(`
        id,
        product_code,
        product_name,
        category,
        quantity,
        unit_price,
        total
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

  async function sendToAccountCurrent() {
    if (!budget) return

    if (budget.status === 'cancelled') {
      toast.error('No se puede pasar a cuenta corriente un presupuesto anulado.')
      return
    }

    if (alreadyInAccount) {
      toast.info('Este presupuesto ya fue enviado a cuenta corriente.')
      return
    }

    try {
      setSendingToAccount(true)

      const budgetLabel = budget.budget_code || `000-${budget.budget_number}`

      const { data: existingMovement, error: existingMovementError } = await supabase
        .from('account_movements')
        .select('id')
        .eq('budget_id', budget.id)
        .eq('movement_type', 'Venta')
        .maybeSingle()

      if (existingMovementError) throw existingMovementError

      if (existingMovement) {
        setAlreadyInAccount(true)
        toast.info('Este presupuesto ya fue enviado a cuenta corriente.')
        return
      }

      const { error } = await supabase.from('account_movements').insert({
        company_id: budget.company_id,
        client_id: budget.client_id,
        budget_id: budget.id,
        movement_type: 'Venta',
        debit: Number(budget.total_amount || calculatedTotal || 0),
        credit: 0,
        description: `Presupuesto ${budgetLabel}`,
      })

      if (error) throw error

      setAlreadyInAccount(true)
      toast.success('Presupuesto enviado a cuenta corriente.')
    } catch (err: any) {
      toast.error(err?.message || 'Error al enviar a cuenta corriente.')
    } finally {
      setSendingToAccount(false)
    }
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
    if (!budget) return

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
          status: 'confirmed',
          source: 'manual',
        })
        .select('id')
        .single()

      if (orderError) throw orderError

      // 2. Create order items
      const orderItems = items.map((item) => ({
        company_id: budget.company_id,
        order_id: orderData.id,
        product_id: item.product_code ? null : null, // This is simplified
        product_code: item.product_code,
        product_name: item.product_name,
        category: item.category,
        quantity: item.quantity,
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      setAssociatedOrderId(orderData.id)
      toast.success('¡Presupuesto convertido a pedido correctamente!')
      
      // Optional: Redirect to order? 
      // router.push(`/pedidos/${orderData.id}`)
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
            margin: 12mm;
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
            color: #0f172a !important;
            box-shadow: none !important;
            border: 0 !important;
          }

          .print-hidden {
            display: none !important;
          }

          .print-card {
            border: 1px solid #d7dee8 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }

          .print-header {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            align-items: start !important;
            gap: 24px !important;
            border-bottom: 2px solid #0f172a !important;
            padding: 0 0 18px 0 !important;
            margin-bottom: 18px !important;
          }

          .print-company-logo {
            max-height: 80px !important;
            max-width: 220px !important;
            object-fit: contain !important;
            margin-bottom: 8px !important;
          }

          .print-title {
            font-size: 28px !important;
            line-height: 1.1 !important;
            font-weight: 900 !important;
            color: #0f172a !important;
          }

          .print-subtitle {
            font-size: 11px !important;
            letter-spacing: 0.22em !important;
            text-transform: uppercase !important;
            color: #475569 !important;
            font-weight: 900 !important;
          }

          .print-client-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 10px !important;
          }

          .print-section {
            padding: 16px 0 !important;
            border-bottom: 1px solid #d7dee8 !important;
          }

          .print-section-title {
            font-size: 18px !important;
            font-weight: 900 !important;
            margin-bottom: 10px !important;
            color: #0f172a !important;
          }

          .print-table-wrap {
            display: block !important;
            overflow: visible !important;
            border: 1px solid #d7dee8 !important;
            border-radius: 0 !important;
          }

          .print-table {
            width: 100% !important;
            min-width: 0 !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 11px !important;
          }

          .print-table th {
            background: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 900 !important;
            padding: 8px !important;
            border-bottom: 1px solid #d7dee8 !important;
          }

          .print-table td {
            padding: 8px !important;
            border-bottom: 1px solid #e2e8f0 !important;
            color: #0f172a !important;
            vertical-align: top !important;
          }

          .print-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .print-total {
            margin-top: 16px !important;
            margin-left: auto !important;
            width: 260px !important;
            border: 2px solid #0f172a !important;
            padding: 12px !important;
            background: white !important;
            color: #0f172a !important;
          }

          .print-total-label {
            font-size: 10px !important;
            letter-spacing: 0.18em !important;
            text-transform: uppercase !important;
            color: #475569 !important;
            font-weight: 900 !important;
          }

          .print-total-number {
            margin-top: 4px !important;
            font-size: 26px !important;
            line-height: 1.1 !important;
            font-weight: 900 !important;
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
                onClick={sendToAccountCurrent}
                disabled={
                  sendingToAccount ||
                  alreadyInAccount ||
                  budget.status === 'cancelled'
                }
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg transition ${
                  alreadyInAccount || budget.status === 'cancelled'
                    ? 'cursor-not-allowed bg-slate-500 shadow-slate-900/20'
                    : 'bg-emerald-600 shadow-emerald-900/30 hover:bg-emerald-500'
                }`}
              >
                {sendingToAccount ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Wallet size={18} />
                )}
                {alreadyInAccount
                  ? 'Ya está en cuenta corriente'
                  : sendingToAccount
                  ? 'Enviando...'
                  : 'Pasar a cuenta corriente'}
              </button>

              <button
                type="button"
                onClick={convertToOrder}
                disabled={
                  convertingToOrder ||
                  Boolean(associatedOrderId) ||
                  budget.status === 'cancelled'
                }
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg transition ${
                  associatedOrderId || budget.status === 'cancelled'
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
                  ? 'Convirtiendo...'
                  : 'Convertir a pedido'}
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

        <section className="print-area print-card rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
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
                   <div className="print-hidden print:hidden">
                     <StatusBadge status={budget.status || 'issued'} />
                   </div>
                </div>
              </div>
            </div>
          </div>

          <div className="print-section border-b border-slate-200 p-6">
            <h2 className="print-section-title text-xl font-black text-slate-950">
              Datos del cliente
            </h2>

            <div className="print-client-grid mt-4 grid gap-4 md:grid-cols-3">
              <ClientData
                icon={User}
                label="Nombre"
                value={budget.clients?.name || '-'}
              />

              <ClientData
                icon={Hash}
                label="CUIT"
                value={budget.clients?.cuit || '-'}
              />

              <ClientData
                icon={MapPin}
                label="Dirección"
                value={budget.clients?.address || '-'}
              />
            </div>
          </div>

          <div className="print-section p-6">
            <h2 className="print-section-title mb-4 text-xl font-black text-slate-950">
              Productos presupuestados
            </h2>

            {items.length === 0 ? (
              <div className="rounded-3xl bg-slate-50 p-10 text-center text-sm font-bold text-slate-500">
                Este presupuesto no tiene productos cargados.
              </div>
            ) : (
              <>
                <div className="print-table-wrap hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
                  <table className="print-table w-full min-w-[850px]">
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
                        const itemTotal =
                          item.total ??
                          Number(item.quantity || 0) *
                            Number(item.unit_price || 0)

                        return (
                          <tr
                            key={item.id}
                            className="transition hover:bg-blue-50/40"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="print-hidden flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 print:hidden">
                                  <Package size={19} />
                                </div>

                                <p className="font-black text-slate-950">
                                  {item.product_name}
                                </p>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              {item.product_code || '-'}
                            </td>

                            <td className="px-5 py-4">
                              {item.category || 'Sin categoría'}
                            </td>

                            <td className="px-5 py-4 text-right font-bold text-slate-700">
                              {Number(item.quantity || 0).toLocaleString(
                                'es-AR'
                              )}
                            </td>

                            <td className="px-5 py-4 text-right font-bold text-slate-700">
                              $
                              {Number(item.unit_price || 0).toLocaleString(
                                'es-AR'
                              )}
                            </td>

                            <td className="px-5 py-4 text-right text-lg font-black text-blue-700">
                              $
                              {Number(itemTotal || 0).toLocaleString('es-AR')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 lg:hidden print-hidden print:hidden">
                  {items.map((item) => {
                    const itemTotal =
                      item.total ??
                      Number(item.quantity || 0) * Number(item.unit_price || 0)

                    return (
                      <article
                        key={item.id}
                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                            <Package size={20} />
                          </div>

                          <div>
                            <h3 className="font-black text-slate-950">
                              {item.product_name}
                            </h3>

                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              Código: {item.product_code || '-'} ·{' '}
                              {item.category || 'Sin categoría'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <MiniData
                            label="Cant."
                            value={Number(item.quantity || 0).toLocaleString(
                              'es-AR'
                            )}
                          />

                          <MiniData
                            label="Precio"
                            value={`$${Number(
                              item.unit_price || 0
                            ).toLocaleString('es-AR')}`}
                          />

                          <MiniData
                            label="Total"
                            value={`$${Number(itemTotal || 0).toLocaleString(
                              'es-AR'
                            )}`}
                          />
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
                    <Clock3 size={14} />
                    Notas y condiciones
                  </h4>
                  <p className="whitespace-pre-line text-sm font-medium text-slate-600">
                    {company.default_notes}
                  </p>
                </div>
              )}

              <div className="print-total ml-auto w-full rounded-3xl bg-slate-950 p-6 text-white md:w-96">
                <p className="print-total-label text-sm font-black uppercase tracking-widest text-blue-200">
                  Total presupuesto
                </p>

                <p className="print-total-number mt-2 text-4xl font-black">
                  ${finalTotal.toLocaleString('es-AR')}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon size={22} />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-500">{title}</p>

          <h2 className="truncate text-xl font-black text-slate-950">
            {value}
          </h2>

          <p className="text-xs font-semibold text-slate-400">{detail}</p>
        </div>
      </div>
    </div>
  )
}

function ClientData({
  icon: Icon,
  label,
  value,
}: {
  icon: any
  label: string
  value: string
}) {
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
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>

      <p className="mt-1 font-black text-slate-900">{value}</p>
    </div>
  )
}

function TableHead({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">
        <XCircle size={17} />
        Anulado
      </span>
    )
  }

  if (status === 'draft') {
    return (
      <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
        <Clock3 size={17} />
        Borrador
      </span>
    )
  }

  if (status === 'approved') {
    return (
      <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">
        <CheckCircle2 size={17} />
        Aprobado
      </span>
    )
  }

  return (
    <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
      <CheckCircle2 size={17} />
      Emitido
    </span>
  )
}