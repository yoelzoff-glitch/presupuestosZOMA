'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { notFound, useParams, useSearchParams } from 'next/navigation'
import { FileText, Printer, Loader2, ArrowLeft, Send, Calendar } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function VerFacturaPage() {
   const params = useParams()
   const searchParams = useSearchParams()
   const id = params.id as string
   const invoiceId = searchParams.get('invoice_id')
   const [budget, setBudget] = useState<any>(null)
   const [loading, setLoading] = useState(true)
   const [emitiendo, setEmitiendo] = useState(false)
   const [serviceDates, setServiceDates] = useState({ desde: '', hasta: '', vto: '' })

   const getInitialDates = () => {
      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth()
      
      const startOfMonth = new Date(year, month, 1)
      const endOfMonth = new Date(year, month + 1, 0)
      const dueDay = new Date(today)
      dueDay.setDate(today.getDate() + 10)
      
      const formatDate = (date: Date) => {
         const y = date.getFullYear()
         const m = String(date.getMonth() + 1).padStart(2, '0')
         const d = String(date.getDate()).padStart(2, '0')
         return `${y}-${m}-${d}`
      }
      
      return {
         desde: formatDate(startOfMonth),
         hasta: formatDate(endOfMonth),
         vto: formatDate(dueDay)
      }
   }

   useEffect(() => {
      if (id) {
         setServiceDates(getInitialDates())
         fetchBudget()
      }
   }, [id])

   async function fetchBudget() {
      setLoading(true)
      const { data: budgetData, error: budgetError } = await supabase
         .from('budgets')
         .select(`
        *,
        clients ( name, cuit, address, email ),
        budget_items ( * ),
        companies ( name, cuit, address, logo_url, business_type ),
        invoices ( id, afip_comprobante_tipo, status, afip_cae, afip_cae_vencimiento, afip_comprobante_numero, total_amount, invoice_date, afip_servicio_desde, afip_servicio_hasta, afip_servicio_vto, invoice_items ( * ) )
      `)
         .eq('id', id)
         .single()

      if (budgetError || !budgetData) {
         console.error('Error fetching budget for invoice:', budgetError)
         setLoading(false)
         return
      }

      let finalBudget = { ...budgetData }
      let activeInvoice = null

      if (invoiceId) {
         const found = budgetData.invoices?.find((i: any) => i.id === invoiceId)
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

   async function emitirFactura() {
      try {
         setEmitiendo(true)
         const response = await fetch('/api/afip/create-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
               budget_id: budget.id,
               serviceDates: budget.companies?.business_type === 'services' ? {
                  FchServDesde: serviceDates.desde,
                  FchServHasta: serviceDates.hasta,
                  FchVtoPago: serviceDates.vto
               } : undefined
            })
         })

         const result = await response.json()
         if (!response.ok) throw new Error(result.error || 'Error al emitir factura')

         toast.success('Factura emitida con éxito')
         fetchBudget() // Recargar para mostrar el CAE
      } catch (error: any) {
         console.error(error)
         toast.error(error.message || 'Error de conexión con AFIP')
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

   // Obtener el tipo de comprobante. Si está emitido, usa el del budget. Si es borrador, usa el de la tabla invoices. Si no, default a 11.
   const comprobanteTipo = budget.afip_comprobante_tipo || (invoice ? invoice.afip_comprobante_tipo : 11)
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

   const formatDateString = (dateStr: string) => {
      if (!dateStr) return '-'
      if (dateStr.length === 8 && !dateStr.includes('-')) {
         const year = dateStr.substring(0, 4)
         const month = dateStr.substring(4, 6)
         const day = dateStr.substring(6, 8)
         return `${day}/${month}/${year}`
      }
      if (dateStr.includes('-')) {
         const parts = dateStr.split('-')
         if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`
         }
      }
      return dateStr
   }

   const realPtoVta = Number(budget?.company_afip_config?.punto_venta) || 4
   const qrData = {
      ver: 1,
      fecha: budget.budget_date,
      cuit: company?.cuit || 20412886128,
      ptoVta: realPtoVta,
      tipoCmp: comprobanteTipo,
      nroCmp: budget.afip_comprobante_numero || 0,
      importe: Math.abs(budget.total_amount),
      moneda: "PES",
      ctz: 1,
      tipoDocRec: 99,
      nroDocRec: 0,
      tipoCodAut: "E",
      codAut: budget.afip_cae || "00000000000000"
   }
   const qrBase64 = typeof window !== 'undefined' ? btoa(JSON.stringify(qrData)) : ''
   const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`

   return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:p-0 print:bg-white font-sans">
         {/* Toolbar (Oculto al imprimir) */}
         <div className="mx-auto mb-6 flex max-w-4xl items-center justify-between rounded-2xl bg-white p-4 shadow-sm print:hidden border border-slate-200">
            <div className="flex items-center gap-3">
               <Link href="/facturas" className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-500">
                  <ArrowLeft size={20} />
               </Link>
               <div className="h-8 w-[1px] bg-slate-200 mx-1" />
               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                  <FileText size={20} />
               </div>
               <div>
                  <h1 className="font-black text-slate-900 leading-none">Comprobante AFIP</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                     {esBorrador ? 'Documento Borrador' : 'Legalizado por ARCA'}
                  </p>
               </div>
            </div>
            <div className="flex gap-2">
               {esBorrador && (
                  <button 
                     onClick={emitirFactura} 
                     disabled={emitiendo}
                     className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-50"
                  >
                     {emitiendo ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 
                     Emitir Factura
                  </button>
               )}
               <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition shadow-lg shadow-slate-200">
                  <Printer size={16} /> Imprimir / Guardar PDF
               </button>
            </div>
         </div>

         {/* Fechas de Servicio si es empresa de Servicios y es borrador */}
         {esBorrador && company?.business_type === 'services' && (
            <div className="mx-auto mb-6 max-w-4xl rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:hidden animate-in fade-in slide-in-from-top-2 duration-200">
               <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                     <Calendar size={18} />
                  </div>
                  <div>
                     <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Período de Facturación del Servicio</h3>
                     <p className="text-[11px] font-medium text-slate-500">Configurá las fechas requeridas por AFIP para la prestación de servicios y vencimiento de pago.</p>
                  </div>
               </div>
               
               <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Servicio Desde</label>
                     <input
                        type="date"
                        value={serviceDates.desde}
                        onChange={(e) => setServiceDates({ ...serviceDates, desde: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        required
                     />
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Servicio Hasta</label>
                     <input
                        type="date"
                        value={serviceDates.hasta}
                        onChange={(e) => setServiceDates({ ...serviceDates, hasta: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        required
                     />
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vencimiento Pago</label>
                     <input
                        type="date"
                        value={serviceDates.vto}
                        onChange={(e) => setServiceDates({ ...serviceDates, vto: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        required
                     />
                  </div>
               </div>
            </div>
         )}

         {/* Factura Layout */}
         <div className="mx-auto max-w-4xl border border-slate-300 bg-white p-10 pt-14 shadow-2xl print:shadow-none print:border-none print:p-0 print:pt-10 rounded-[2rem] print:rounded-none overflow-hidden relative">
            
            {/* Marca de agua / Decoración */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none print:hidden">
               <FileText size={200} />
            </div>

            {esAnulada && (
               <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-black text-rose-700 flex items-center justify-between print:hidden">
                  <span className="flex items-center gap-2">
                     ⚠️ Este comprobante ha sido ANULADO mediante una Nota de Crédito.
                  </span>
                  <span className="bg-rose-600 text-white px-2.5 py-1 rounded-md text-[9px] uppercase tracking-wider">
                     Documento sin validez comercial
                  </span>
               </div>
            )}

            {esBorrador && (
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none opacity-[0.05] z-0">
                  <p className="text-[140px] font-black tracking-tighter whitespace-nowrap text-slate-900">BORRADOR</p>
               </div>
            )}

            {esAnulada && (
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none opacity-[0.08] z-10">
                  <p className="text-[120px] font-black tracking-tighter whitespace-nowrap text-rose-600 border-8 border-rose-600 px-10 rounded-3xl uppercase">ANULADA</p>
               </div>
            )}

            {/* Cabecera */}
            <div className="flex border-2 border-slate-900 relative">
               <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 flex h-16 w-16 items-center justify-center border-2 border-slate-900 bg-white text-4xl font-black z-10 shadow-sm">
                  {getComprobanteLetra(comprobanteTipo)}
               </div>

               <div className="flex-1 p-6 border-r-2 border-slate-900 bg-slate-50/30">
                  <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">{company?.name || 'ZOMA TEST'}</h2>
                  <div className="mt-4 space-y-1 text-xs font-bold text-slate-600">
                     <p>Razón Social: {company?.name}</p>
                     <p>Domicilio: {company?.address || 'Calle Falsa 123, Buenos Aires'}</p>
                     <p>Condición frente al IVA: {condicionIvaEmpresa}</p>
                  </div>
               </div>

               <div className="w-20 flex flex-col items-center justify-end pb-4 bg-white">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cod. {String(comprobanteTipo).padStart(3, '0')}</p>
               </div>

               <div className="flex-1 p-6 border-l-2 border-slate-900 bg-slate-50/30">
                  <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">{getComprobanteNombre(comprobanteTipo)}</h2>
                  <div className="mt-4 space-y-1 text-sm font-black text-slate-900">
                     <p>Punto de Venta: {String(qrData.ptoVta).padStart(5, '0')}</p>
                     <p>Comp. Nro: {budget.afip_comprobante_numero ? String(budget.afip_comprobante_numero).padStart(8, '0') : '---'}</p>
                     <p>Fecha: {new Date(budget.budget_date).toLocaleDateString('es-AR')}</p>
                     <div className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        <p>CUIT: {company?.cuit || '20-41288612-8'}</p>
                        <p>Ingresos Brutos: {company?.cuit}</p>
                        <p>Inicio de Actividades: 01/01/2024</p>
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
                              ? formatDateString(serviceDates.desde)
                              : formatDateString(budget.afip_servicio_desde)}
                        </span>
                     </p>
                     <p>
                        <span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Hasta:</span>
                        <span className="font-black text-slate-900">
                           {esBorrador 
                              ? formatDateString(serviceDates.hasta)
                              : formatDateString(budget.afip_servicio_hasta)}
                        </span>
                     </p>
                     <p>
                        <span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Vto. para el Pago:</span>
                        <span className="font-black text-slate-900">
                           {esBorrador 
                              ? formatDateString(serviceDates.vto)
                              : formatDateString(budget.afip_servicio_vto)}
                        </span>
                     </p>
                  </div>
               </div>
            )}

            {/* Datos del Receptor */}
            <div className="mt-4 rounded-none border-2 border-slate-900 p-4 bg-slate-50/10">
               <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs font-bold text-slate-800">
                  <p><span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Apellido y Nombre / Razón Social:</span> {client?.name}</p>
                  <p><span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">CUIT:</span> {client?.cuit || 'Consumidor Final'}</p>
                  <p><span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Condición IVA:</span> {comprobanteTipo === 1 ? 'Responsable Inscripto' : 'Consumidor Final'}</p>
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
                     {items.map((item: any, idx: number) => {
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
                  <div className="h-28 w-28 border-2 border-slate-900 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                     <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`}
                        alt="QR AFIP"
                        className="h-24 w-24"
                     />
                  </div>
                  <div className="text-[10px] font-black uppercase text-slate-900 space-y-1">
                     <p className={`flex items-center gap-2 mb-2 px-2 py-1 w-fit rounded ${esBorrador ? 'bg-amber-100 text-amber-700' : 'bg-slate-900 text-white'}`}>
                        <img src="https://www.afip.gob.ar/images/logo_afip.png" className={`h-3 ${esBorrador ? 'grayscale' : 'brightness-0 invert'}`} alt="AFIP" />
                        {esBorrador ? 'Borrador sin autorizar' : 'Comprobante Autorizado'}
                     </p>
                     <p>CAE: <span className={`font-black text-base ml-1 tracking-tighter ${esBorrador ? 'text-slate-400' : 'text-indigo-600'}`}>{budget.afip_cae || "00000000000000"}</span></p>
                     <p>Vencimiento CAE: {budget.afip_cae_vencimiento ? new Date(budget.afip_cae_vencimiento).toLocaleDateString('es-AR') : '--/--/----'}</p>
                  </div>
               </div>

               <div className="w-64 border-2 border-slate-900 bg-slate-50/50">
                  <div className="p-4 space-y-2 text-sm">
                     {esComprobanteA ? (
                        <>
                           <div className="flex justify-between font-bold text-slate-500">
                              <span>Subtotal (Neto):</span>
                              <span>${(Number(budget.total_amount) / 1.21).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                           </div>
                           <div className="flex justify-between font-bold text-slate-500">
                              <span>IVA (21%):</span>
                              <span>${(Number(budget.total_amount) - (Number(budget.total_amount) / 1.21)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                           </div>
                        </>
                     ) : (
                        <>
                           <div className="flex justify-between font-bold text-slate-500">
                              <span>Subtotal:</span>
                              <span>${budget.total_amount.toLocaleString('es-AR')}</span>
                           </div>
                           <div className="flex justify-between font-bold text-slate-500">
                              <span>IVA:</span>
                              <span>$0,00</span>
                           </div>
                        </>
                     )}
                     <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-xl font-black text-slate-950">
                        <span>Total:</span>
                        <span>${budget.total_amount.toLocaleString('es-AR')}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="mt-10 text-center text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
               Esta es una representación gráfica de un comprobante electrónico autorizado por ARCA (AFIP).
            </div>
         </div>
      </div>
   )
}
