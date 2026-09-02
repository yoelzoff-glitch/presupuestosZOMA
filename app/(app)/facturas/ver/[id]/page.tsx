'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { notFound, useParams, useSearchParams } from 'next/navigation'
import { FileText, Printer, Loader2, ArrowLeft, Send, AlertTriangle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import InvoicePreviewModal from '@/app/components/InvoicePreviewModal'
import {
   formatArcaDateForDisplay,
   getDefaultServiceDates,
   buildArcaQrPayload,
   generateArcaQrDataUrl,
   getCondicionIvaLabel
} from '@/lib/arca/invoiceRepresentation'

interface InvoiceRow {
   id: string
   afip_comprobante_tipo?: number
   afip_punto_venta?: number
   arca_environment?: 'homo' | 'prod'
   status?: 'draft' | 'emitted' | 'cancelled'
   afip_cae?: string
   afip_cae_vencimiento?: string
   afip_comprobante_numero?: number
   total_amount?: number
   invoice_date?: string
   afip_servicio_desde?: string
   afip_servicio_hasta?: string
   afip_servicio_vto?: string
   afip_doc_tipo_receptor?: number
   afip_doc_nro_receptor?: string
   afip_condicion_iva_receptor?: number
   invoice_items?: Array<{ product_code?: string; product_name: string; quantity: number; unit_price: number }>
}

interface BudgetViewData {
   id: string
   company_id?: string
   budget_date?: string
   total_amount?: number
   afip_cae?: string
   afip_cae_vencimiento?: string
   afip_comprobante_numero?: number
   afip_comprobante_tipo?: number
   afip_punto_venta?: number
   arca_environment?: 'homo' | 'prod'
   afip_servicio_desde?: string
   afip_servicio_hasta?: string
   afip_servicio_vto?: string
   clients?: { name?: string; cuit?: string; address?: string; email?: string; condicion_iva?: string; afip_condicion_iva_receptor?: number } | Array<{ name?: string; cuit?: string; address?: string; email?: string; condicion_iva?: string; afip_condicion_iva_receptor?: number }>
   companies?: { name?: string; cuit?: string; address?: string; logo_url?: string; business_type?: string; legal_name?: string; fiscal_address?: string; iibb_number?: string; activity_start_date?: string }
   budget_items?: Array<{ product_code?: string; product_name: string; quantity: number; unit_price: number }>
   invoices?: InvoiceRow[]
   selected_invoice?: InvoiceRow
   company_afip_config?: { tipo_contribuyente?: string; punto_venta?: number }
}

export default function VerFacturaPage() {
   const params = useParams()
   const searchParams = useSearchParams()
   const id = params.id as string
   const invoiceId = searchParams.get('invoice_id')
   const [budget, setBudget] = useState<BudgetViewData | null>(null)
   const [loading, setLoading] = useState(true)
   const [emitiendo, setEmitiendo] = useState(false)
   const [modalPreviewOpen, setModalPreviewOpen] = useState(false)
   const [serviceDates] = useState(() => {
      const d = getDefaultServiceDates()
      return { desde: d.FchServDesde, hasta: d.FchServHasta, vto: d.FchVtoPago }
   })
   const [qrDataUrl, setQrDataUrl] = useState<string>('')

   useEffect(() => {
      if (!id) return
      let isMounted = true

      const timer = setTimeout(async () => {
         setLoading(true)
         const { data: budgetData, error: budgetError } = await supabase
            .from('budgets')
            .select(`
           *,
           clients ( name, cuit, address, email, condicion_iva ),
           budget_items ( * ),
           companies ( name, cuit, address, logo_url, business_type, legal_name, fiscal_address, iibb_number, activity_start_date ),
           invoices ( id, afip_comprobante_tipo, afip_punto_venta, arca_environment, status, afip_cae, afip_cae_vencimiento, afip_comprobante_numero, total_amount, invoice_date, afip_servicio_desde, afip_servicio_hasta, afip_servicio_vto, afip_doc_tipo_receptor, afip_doc_nro_receptor, afip_condicion_iva_receptor, invoice_items ( * ) )
         `)
            .eq('id', id)
            .single()

         if (!isMounted) return
         if (budgetError || !budgetData) {
            console.error('Error fetching budget for invoice:', budgetError)
            setLoading(false)
            return
         }

         const finalBudget = { ...budgetData }
         let activeInvoice = null

         if (invoiceId) {
            const found = budgetData.invoices?.find((i: { id: string }) => i.id === invoiceId)
            if (found) {
               activeInvoice = found
            }
         } else if (budgetData.invoices && budgetData.invoices.length > 0) {
            activeInvoice = budgetData.invoices[0]
         }

         if (activeInvoice) {
            finalBudget.afip_cae = activeInvoice.afip_cae
            finalBudget.afip_cae_vencimiento = activeInvoice.afip_cae_vencimiento
            finalBudget.afip_comprobante_numero = activeInvoice.afip_comprobante_numero
            finalBudget.afip_comprobante_tipo = activeInvoice.afip_comprobante_tipo
            finalBudget.afip_punto_venta = activeInvoice.afip_punto_venta || finalBudget.afip_punto_venta
            finalBudget.arca_environment = activeInvoice.arca_environment || finalBudget.arca_environment
            finalBudget.total_amount = activeInvoice.total_amount
            if (activeInvoice.invoice_date) {
               finalBudget.budget_date = activeInvoice.invoice_date
            }
            finalBudget.selected_invoice = activeInvoice

            if (activeInvoice.invoice_items && activeInvoice.invoice_items.length > 0) {
               finalBudget.budget_items = activeInvoice.invoice_items
            }

            // Sincronizar fechas de servicio facturadas
            finalBudget.afip_servicio_desde = activeInvoice.afip_servicio_desde
            finalBudget.afip_servicio_hasta = activeInvoice.afip_servicio_hasta
            finalBudget.afip_servicio_vto = activeInvoice.afip_servicio_vto
         }

         // Fetch company's AFIP configuration
         const companyId = budgetData.company_id
         if (companyId) {
            const { data: afipData } = await supabase
               .from('afip_configs')
               .select('tipo_contribuyente, punto_venta')
               .eq('company_id', companyId)
               .maybeSingle()

            if (afipData && isMounted) {
               finalBudget.company_afip_config = afipData
            }
         }

         if (isMounted) {
            setBudget(finalBudget)
            setLoading(false)
         }
      }, 0)

      return () => {
         isMounted = false
         clearTimeout(timer)
      }
   }, [id, invoiceId])

   async function fetchBudget() {
      setLoading(true)
      const { data: budgetData, error: budgetError } = await supabase
         .from('budgets')
         .select(`
        *,
        clients ( name, cuit, address, email, condicion_iva ),
        budget_items ( * ),
        companies ( name, cuit, address, logo_url, business_type, legal_name, fiscal_address, iibb_number, activity_start_date ),
        invoices ( id, afip_comprobante_tipo, afip_punto_venta, arca_environment, status, afip_cae, afip_cae_vencimiento, afip_comprobante_numero, total_amount, invoice_date, afip_servicio_desde, afip_servicio_hasta, afip_servicio_vto, afip_doc_tipo_receptor, afip_doc_nro_receptor, afip_condicion_iva_receptor, invoice_items ( * ) )
      `)
         .eq('id', id)
         .single()

      if (budgetError || !budgetData) {
         console.error('Error fetching budget for invoice:', budgetError)
         setLoading(false)
         return
      }

      const finalBudget = { ...budgetData }
      let activeInvoice = null

      if (invoiceId) {
         const found = budgetData.invoices?.find((i: { id: string }) => i.id === invoiceId)
         if (found) {
            activeInvoice = found
         }
      } else if (budgetData.invoices && budgetData.invoices.length > 0) {
         activeInvoice = budgetData.invoices[0]
      }

      if (activeInvoice) {
         finalBudget.afip_cae = activeInvoice.afip_cae
         finalBudget.afip_cae_vencimiento = activeInvoice.afip_cae_vencimiento
         finalBudget.afip_comprobante_numero = activeInvoice.afip_comprobante_numero
         finalBudget.afip_comprobante_tipo = activeInvoice.afip_comprobante_tipo
         finalBudget.afip_punto_venta = activeInvoice.afip_punto_venta || finalBudget.afip_punto_venta
         finalBudget.arca_environment = activeInvoice.arca_environment || finalBudget.arca_environment
         finalBudget.total_amount = activeInvoice.total_amount
         if (activeInvoice.invoice_date) {
            finalBudget.budget_date = activeInvoice.invoice_date
         }
         finalBudget.selected_invoice = activeInvoice

         if (activeInvoice.invoice_items && activeInvoice.invoice_items.length > 0) {
            finalBudget.budget_items = activeInvoice.invoice_items
         }

         // Sincronizar fechas de servicio facturadas
         finalBudget.afip_servicio_desde = activeInvoice.afip_servicio_desde
         finalBudget.afip_servicio_hasta = activeInvoice.afip_servicio_hasta
         finalBudget.afip_servicio_vto = activeInvoice.afip_servicio_vto
      }

      // Fetch company's AFIP configuration
      const companyId = budgetData.company_id
      if (companyId) {
         const { data: afipData } = await supabase
            .from('afip_configs')
            .select('tipo_contribuyente, punto_venta')
            .eq('company_id', companyId)
            .maybeSingle()

         if (afipData) {
            finalBudget.company_afip_config = afipData
         }
      }

      setBudget(finalBudget)
      setLoading(false)
   }

   // Generar código QR oficial localmente si está emitido en PRODUCCIÓN
   useEffect(() => {
      if (!budget) return

      let isMounted = true
      const timer = setTimeout(async () => {
         const invoice = budget.selected_invoice || (budget.invoices && budget.invoices.length > 0 ? budget.invoices[0] : null)
         const arcaEnv = budget.arca_environment || invoice?.arca_environment
         const isProd = arcaEnv === 'prod' && Boolean(budget.afip_cae) && Boolean(budget.afip_comprobante_numero)
         const company = budget.companies
         const client = Array.isArray(budget.clients) ? budget.clients[0] : budget.clients

         if (isProd && company?.cuit) {
            try {
               const ptoVta = Number(budget.afip_punto_venta || invoice?.afip_punto_venta || budget?.company_afip_config?.punto_venta || 1)
               const tipoCmp = Number(budget.afip_comprobante_tipo || invoice?.afip_comprobante_tipo || 11)
               const docTipo = Number(
                  invoice?.afip_doc_tipo_receptor != null
                     ? invoice.afip_doc_tipo_receptor
                     : (client?.cuit?.replace(/\D/g, '').length === 11 ? 80 : 99)
               )
               const docNro = (
                  invoice?.afip_doc_nro_receptor != null
                     ? String(invoice.afip_doc_nro_receptor)
                     : (client?.cuit?.replace(/\D/g, '') || '0')
               )

               const qrPayload = buildArcaQrPayload({
                  fecha: budget.budget_date || '',
                  cuit: company.cuit,
                  ptoVta,
                  tipoCmp,
                  nroCmp: Number(budget.afip_comprobante_numero || 0),
                  importe: Number(budget.total_amount || 0),
                  tipoDocRec: docTipo,
                  nroDocRec: docNro,
                  codAut: budget.afip_cae || ''
               })

               const url = await generateArcaQrDataUrl(qrPayload.url)
               if (isMounted) setQrDataUrl(url)
            } catch (err) {
               console.error('Error generando QR oficial:', err)
               if (isMounted) setQrDataUrl('')
            }
         } else {
            if (isMounted) setQrDataUrl('')
         }
      }, 0)

      return () => {
         isMounted = false
         clearTimeout(timer)
      }
   }, [budget])

   async function emitirFacturaConParametros(
      tipoCbte: number,
      addIva: boolean,
      env: 'homo' | 'prod',
      srvDates?: { FchServDesde: string; FchServHasta: string; FchVtoPago: string }
   ) {
      try {
         setEmitiendo(true)
         const response = await fetch('/api/afip/create-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               budget_id: budget?.id || id,
               environment: env,
               cbteTipoOverride: tipoCbte,
               addIva,
               serviceDates: srvDates
            })
         })

         const result = await response.json()
         if (!response.ok || !result.success) {
            throw new Error(result.error || 'Error al emitir factura en ARCA')
         }

         toast.success(`Factura autorizada con éxito en ${env.toUpperCase()} (CAE: ${result.cae})`)
         setModalPreviewOpen(false)
         fetchBudget()
      } catch (error: unknown) {
         const err = error as Error
         console.error(err)
         toast.error(err.message || 'Error de conexión con ARCA')
      } finally {
         setEmitiendo(false)
      }
   }

   if (loading) return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
         <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
   )

   if (!budget) return notFound()

   const client = Array.isArray(budget.clients) ? budget.clients[0] : budget.clients
   const company = budget.companies
   const items = budget.budget_items || []

   const esBorrador = !budget.afip_cae
   const invoice = budget.selected_invoice || (budget.invoices && budget.invoices.length > 0 ? budget.invoices[0] : null)
   const esAnulada = budget.selected_invoice ? false : (invoice?.status === 'cancelled')
   const arcaEnv: 'homo' | 'prod' = budget.arca_environment || invoice?.arca_environment || 'homo'
   const esProdOficial = !esBorrador && arcaEnv === 'prod'
   const esHomoTesting = !esBorrador && arcaEnv === 'homo'

   const comprobanteTipo = Number(budget.afip_comprobante_tipo || (invoice ? invoice.afip_comprobante_tipo : 11) || 11)
   const esComprobanteA = [1, 2, 3, 7, 8].includes(comprobanteTipo)

   const afipConfig = budget.company_afip_config
   const condicionIvaEmpresa = afipConfig?.tipo_contribuyente === 'responsable_inscripto'
      ? 'Responsable Inscripto'
      : (afipConfig?.tipo_contribuyente === 'monotributo'
         ? 'Responsable Monotributo'
         : ([11, 12, 13].includes(comprobanteTipo) ? 'Responsable Monotributo' : 'Responsable Inscripto'))

   const getComprobanteLetra = (tipo: number) => {
      if ([1, 2, 3].includes(tipo)) return 'A'
      if ([6, 7, 8].includes(tipo)) return 'B'
      if ([11, 12, 13].includes(tipo)) return 'C'
      return 'C'
   }

   const getComprobanteNombre = (tipo: number) => {
      if ([1, 6, 11].includes(tipo)) return 'Factura'
      if ([3, 8, 13].includes(tipo)) return 'Nota de Crédito'
      if ([2, 7, 12].includes(tipo)) return 'Nota de Débito'
      return 'Factura'
   }

   // Punto de venta persistido en la factura o budget
   const realPtoVta = Number(budget.afip_punto_venta || invoice?.afip_punto_venta || budget?.company_afip_config?.punto_venta || 1)

   // Validación de completitud fiscal del emisor para comprobantes PROD
   const emisorFiscalIncompleto = esProdOficial && (
      !(company?.legal_name || company?.name) ||
      !company?.cuit ||
      !(company?.fiscal_address || company?.address) ||
      !company?.activity_start_date
   )

   function handlePrint() {
      if (emisorFiscalIncompleto) {
         toast.error('Datos fiscales del emisor incompletos para comprobante PROD. Complete Razón Social, Domicilio Fiscal, CUIT e Inicio de Actividades en Configuración de Empresa.')
         return
      }
      window.print()
   }

   const receptorCondicionLabel = getCondicionIvaLabel(
      invoice?.afip_condicion_iva_receptor != null
         ? invoice.afip_condicion_iva_receptor
         : (client?.condicion_iva === 'responsable_inscripto' ? 1 : 5)
   )

   const receptorDocLabel = (invoice?.afip_doc_tipo_receptor === 80 || client?.cuit?.replace(/\D/g, '').length === 11) ? 'CUIT:' : 'DNI/Doc:'
   const receptorDocNro = invoice?.afip_doc_nro_receptor || client?.cuit || 'Consumidor Final'

   return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:p-0 print:bg-white font-sans">
         {/* Toolbar (Oculto al imprimir) */}
         <div className="mx-auto mb-6 flex max-w-4xl items-center justify-between rounded-2xl bg-white p-4 shadow-sm print:hidden border border-slate-200">
            <div className="flex items-center gap-3">
               <Link href="/facturas" className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-500">
                  <ArrowLeft size={20} />
               </Link>
               <div className="h-8 w-[1px] bg-slate-200 mx-1" />
               <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg ${
                  esProdOficial ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200'
               }`}>
                  <FileText size={20} />
               </div>
               <div>
                  <h1 className="font-black text-slate-900 leading-none">Comprobante AFIP</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                     {esBorrador
                        ? 'Documento Borrador'
                        : (esProdOficial ? 'Legalizado por ARCA (Producción)' : 'Homologación (Testing - Sin validez fiscal)')}
                  </p>
               </div>
            </div>
            <div className="flex gap-2">
               {esBorrador && (
                  <button
                     onClick={() => setModalPreviewOpen(true)}
                     disabled={emitiendo}
                     className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-50"
                  >
                     {emitiendo ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                     Emitir Factura
                  </button>
               )}
               <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition shadow-lg shadow-slate-200"
               >
                  <Printer size={16} /> Imprimir / Guardar PDF
               </button>
            </div>
         </div>

         {/* Alerta si faltan datos del emisor para imprimir PROD */}
         {emisorFiscalIncompleto && (
            <div className="mx-auto mb-6 max-w-4xl rounded-2xl bg-red-50 border-2 border-red-300 p-4 text-xs font-bold text-red-900 flex items-center justify-between shadow-sm print:hidden">
               <div className="flex items-center gap-2">
                  <AlertCircle className="text-red-600 shrink-0" size={18} />
                  <span>
                     Datos fiscales del emisor incompletos para comprobante PROD: Verifique Razón Social, Domicilio Fiscal, CUIT e Inicio de Actividades en <Link href="/configuracion/empresa" className="underline font-black">Datos de la empresa</Link>.
                  </span>
               </div>
            </div>
         )}

         {/* Banner de Homologación si es comprobante de testing */}
         {esHomoTesting && (
            <div className="mx-auto mb-6 max-w-4xl rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 text-xs font-black text-amber-900 flex items-center justify-between shadow-sm">
               <div className="flex items-center gap-2">
                  <AlertTriangle className="text-amber-600 shrink-0" size={18} />
                  <span>HOMOLOGACIÓN — SIN VALIDEZ FISCAL (Comprobante generado en ambiente de testing ARCA Sandbox)</span>
               </div>
               <span className="bg-amber-600 text-white px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider">
                  Testing
               </span>
            </div>
         )}

         {/* Factura Layout */}
         <div className="mx-auto max-w-4xl border border-slate-300 bg-white p-10 pt-14 shadow-2xl print:shadow-none print:border-none print:p-0 print:pt-10 rounded-[2rem] print:rounded-none overflow-hidden relative">

            {/* Marcas de agua */}
            {esHomoTesting && (
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none opacity-[0.07] z-0 select-none">
                  <p className="text-[90px] font-black tracking-tighter whitespace-nowrap text-amber-800 border-8 border-amber-800 px-12 py-4 rounded-3xl uppercase">
                     SIN VALIDEZ FISCAL
                  </p>
               </div>
            )}

            {esBorrador && (
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none opacity-[0.05] z-0 select-none">
                  <p className="text-[140px] font-black tracking-tighter whitespace-nowrap text-slate-900">BORRADOR</p>
               </div>
            )}

            {esAnulada && (
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none opacity-[0.08] z-10 select-none">
                  <p className="text-[120px] font-black tracking-tighter whitespace-nowrap text-rose-600 border-8 border-rose-600 px-10 rounded-3xl uppercase">ANULADA</p>
               </div>
            )}

            {/* Cabecera */}
            <div className="flex border-2 border-slate-900 relative">
               <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 flex h-16 w-16 items-center justify-center border-2 border-slate-900 bg-white text-4xl font-black z-10 shadow-sm">
                  {getComprobanteLetra(comprobanteTipo)}
               </div>

               <div className="flex-1 p-6 border-r-2 border-slate-900 bg-slate-50/30">
                  <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">{company?.legal_name || company?.name || 'EMPRESA'}</h2>
                  <div className="mt-4 space-y-1 text-xs font-bold text-slate-600">
                     <p>Razón Social: {company?.legal_name || company?.name || '---'}</p>
                     <p>Domicilio Fiscal: {company?.fiscal_address || company?.address || '---'}</p>
                     <p>Condición frente al IVA: {condicionIvaEmpresa}</p>
                  </div>
               </div>

               <div className="w-20 flex flex-col items-center justify-end pb-4 bg-white">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cod. {String(comprobanteTipo).padStart(3, '0')}</p>
               </div>

               <div className="flex-1 p-6 border-l-2 border-slate-900 bg-slate-50/30">
                  <div className="flex items-center justify-between">
                     <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">{getComprobanteNombre(comprobanteTipo)}</h2>
                     {esProdOficial && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded">
                           PRODUCCIÓN
                        </span>
                     )}
                     {esHomoTesting && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-amber-600 text-white px-2 py-0.5 rounded">
                           HOMOLOGACIÓN
                        </span>
                     )}
                  </div>
                  <div className="mt-4 space-y-1 text-sm font-black text-slate-900">
                     <p>Punto de Venta: {String(realPtoVta).padStart(5, '0')}</p>
                     <p>Comp. Nro: {budget.afip_comprobante_numero ? String(budget.afip_comprobante_numero).padStart(8, '0') : '---'}</p>
                     <p>Fecha de Emisión: {formatArcaDateForDisplay(budget.budget_date)}</p>
                     <div className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest space-y-0.5">
                        <p>CUIT: {company?.cuit || '---'}</p>
                        <p>Ingresos Brutos: {company?.iibb_number || company?.cuit || '---'}</p>
                        <p>Inicio de Actividades: {company?.activity_start_date ? formatArcaDateForDisplay(company.activity_start_date) : '---'}</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Período del Servicio (Solo si es empresa de Servicios) */}
            {company?.business_type === 'services' && (
               <div className="mt-4 border-2 border-slate-900 p-4 bg-slate-50/10">
                  <div className="grid grid-cols-3 gap-4 text-xs font-bold text-slate-800">
                     <p>
                        <span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Período Facturado Desde:</span>
                        <span className="font-black text-slate-900">
                           {esBorrador
                              ? formatArcaDateForDisplay(serviceDates.desde)
                              : formatArcaDateForDisplay(budget.afip_servicio_desde)}
                        </span>
                     </p>
                     <p>
                        <span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Hasta:</span>
                        <span className="font-black text-slate-900">
                           {esBorrador
                              ? formatArcaDateForDisplay(serviceDates.hasta)
                              : formatArcaDateForDisplay(budget.afip_servicio_hasta)}
                        </span>
                     </p>
                     <p>
                        <span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Vto. para el Pago:</span>
                        <span className="font-black text-slate-900">
                           {esBorrador
                              ? formatArcaDateForDisplay(serviceDates.vto)
                              : formatArcaDateForDisplay(budget.afip_servicio_vto)}
                        </span>
                     </p>
                  </div>
               </div>
            )}

            {/* Datos del Receptor */}
            <div className="mt-4 rounded-none border-2 border-slate-900 p-4 bg-slate-50/10">
               <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs font-bold text-slate-800">
                  <p><span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Apellido y Nombre / Razón Social:</span> {client?.name}</p>
                  <p><span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">{receptorDocLabel}</span> {receptorDocNro}</p>
                  <p><span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Condición IVA:</span> {receptorCondicionLabel}</p>
                  <p><span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Domicilio:</span> {client?.address || '-'}</p>
               </div>
            </div>

            {/* Tabla de Items */}
            <div className="mt-4 border-2 border-slate-900 overflow-hidden">
               <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-900 border-b-2 border-slate-900 font-black uppercase text-white">
                     <tr>
                        <th className="px-4 py-2.5">Código / Detalle</th>
                        <th className="px-4 py-2.5 text-center">Cantidad</th>
                        <th className="px-4 py-2.5">U. Medida</th>
                        <th className="px-4 py-2.5 text-right">Precio Unit.</th>
                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-bold text-slate-800">
                     {items.map((item: { product_code?: string; product_name: string; quantity: number; unit_price: number }, idx: number) => {
                        const unitPrice = esComprobanteA ? (Number(item.unit_price) / 1.21) : Number(item.unit_price);
                        const rowSubtotal = item.quantity * unitPrice;
                        return (
                           <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="px-4 py-2.5">{item.product_code ? `[${item.product_code}] ` : ''}{item.product_name}</td>
                              <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                              <td className="px-4 py-2.5 uppercase text-slate-500">Unid.</td>
                              <td className="px-4 py-2.5 text-right">${unitPrice.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-4 py-2.5 text-right font-black">${rowSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                           </tr>
                        )
                     })}
                     {[...Array(Math.max(0, 10 - items.length))].map((_, i) => (
                        <tr key={`empty-${i}`} className="h-6">
                           <td colSpan={5}></td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            {/* Totales y AFIP Info */}
            <div className="mt-4 flex justify-between items-start">
               <div className="flex gap-6 items-center">
                  <div className="h-28 w-28 border-2 border-slate-900 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm p-1">
                     {qrDataUrl ? (
                        <img
                           src={qrDataUrl}
                           alt="QR Oficial ARCA"
                           className="h-24 w-24 object-contain"
                        />
                     ) : (
                        <div className="flex flex-col items-center justify-center text-center p-1 text-[8px] font-bold text-slate-400">
                           <FileText size={20} className="text-slate-300 mb-1" />
                           {esHomoTesting ? 'Sin QR Fiscal (HOMO)' : 'Sin QR (Borrador)'}
                        </div>
                     )}
                  </div>
                  <div className="text-[10px] font-black uppercase text-slate-900 space-y-1">
                     <p className={`flex items-center gap-2 mb-2 px-2 py-1 w-fit rounded ${
                        esBorrador
                           ? 'bg-amber-100 text-amber-700'
                           : (esProdOficial ? 'bg-slate-900 text-white' : 'bg-amber-600 text-white')
                     }`}>
                        <img src="https://www.afip.gob.ar/images/logo_afip.png" className={`h-3 ${esBorrador ? 'grayscale' : 'brightness-0 invert'}`} alt="AFIP" />
                        {esBorrador ? 'Borrador sin autorizar' : (esProdOficial ? 'Comprobante Autorizado (PROD)' : 'Autorizado en Testing (HOMO)')}
                     </p>
                     <p>CAE: <span className={`font-black text-base ml-1 tracking-tighter ${esBorrador ? 'text-slate-400' : 'text-indigo-600'}`}>{budget.afip_cae || "00000000000000"}</span></p>
                     <p>Vencimiento CAE: {budget.afip_cae_vencimiento ? formatArcaDateForDisplay(budget.afip_cae_vencimiento) : '--/--/----'}</p>
                  </div>
               </div>

               <div className="w-64 border-2 border-slate-900 bg-slate-50/50">
                  <div className="p-4 space-y-2 text-sm">
                     {esComprobanteA ? (
                        <>
                           <div className="flex justify-between font-bold text-slate-500">
                              <span>Subtotal (Neto):</span>
                              <span>${(Number(budget.total_amount || 0) / 1.21).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                           </div>
                           <div className="flex justify-between font-bold text-slate-500">
                              <span>IVA (21%):</span>
                              <span>${(Number(budget.total_amount || 0) - (Number(budget.total_amount || 0) / 1.21)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                           </div>
                        </>
                     ) : (
                        <>
                           <div className="flex justify-between font-bold text-slate-500">
                              <span>Subtotal:</span>
                              <span>${(budget.total_amount || 0).toLocaleString('es-AR')}</span>
                           </div>
                           <div className="flex justify-between font-bold text-slate-500">
                              <span>IVA:</span>
                              <span>$0,00</span>
                           </div>
                        </>
                     )}
                     <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-xl font-black text-slate-950">
                        <span>Total:</span>
                        <span>${(budget.total_amount || 0).toLocaleString('es-AR')}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="mt-10 text-center text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
               {esProdOficial
                  ? 'Esta es una representación gráfica de un comprobante electrónico autorizado por ARCA (AFIP) en ambiente de Producción Oficial.'
                  : (esHomoTesting
                     ? 'COMPROBANTE DE HOMOLOGACIÓN / PRUEBAS — SIN VALIDEZ FISCAL NI COMERCIAL.'
                     : 'Documento Borrador sin validez contable ni impositiva.')}
            </div>
         </div>

         {/* Modal de Previsualización y Emisión con Selección Explícita */}
         {modalPreviewOpen && (
            <InvoicePreviewModal
               isOpen={modalPreviewOpen}
               onClose={() => setModalPreviewOpen(false)}
               onConfirm={(tipo, addIva, env, srvDates) => {
                  emitirFacturaConParametros(tipo, addIva, env, srvDates)
               }}
               budgetId={budget.id}
               clientName={client?.name || ''}
               totalAmount={budget.total_amount || 0}
               isEmitting={emitiendo}
            />
         )}
      </div>
   )
}
