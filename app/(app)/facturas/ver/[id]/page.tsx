'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { notFound, useParams } from 'next/navigation'
import { FileText, Printer, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function VerFacturaPage() {
   const params = useParams()
   const id = params.id as string
   const [budget, setBudget] = useState<any>(null)
   const [loading, setLoading] = useState(true)

   useEffect(() => {
      if (id) {
         fetchBudget()
      }
   }, [id])

   async function fetchBudget() {
      setLoading(true)
      const { data, error } = await supabase
         .from('budgets')
         .select(`
        *,
        clients ( name, cuit, address, email ),
        budget_items ( * ),
        companies ( name, cuit, address, logo_url )
      `)
         .eq('id', id)
         .single()

      if (error || !data || !data.afip_cae) {
         console.error('Error fetching budget for invoice:', error)
      } else {
         setBudget(data)
      }
      setLoading(false)
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

   const qrData = {
      ver: 1,
      fecha: budget.budget_date,
      cuit: company?.cuit || 20412886128,
      ptoVta: 2,
      tipoCmp: budget.afip_comprobante_tipo,
      nroCmp: budget.afip_comprobante_numero,
      importe: budget.total_amount,
      moneda: "PES",
      ctz: 1,
      tipoDocRec: 99,
      nroDocRec: 0,
      tipoCodAut: "E",
      codAut: budget.afip_cae
   }
   const qrBase64 = Buffer.from(JSON.stringify(qrData)).toString('base64')
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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Legalizado por ARCA</p>
               </div>
            </div>
            <div className="flex gap-2">
               <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition shadow-lg shadow-slate-200">
                  <Printer size={16} /> Imprimir / Guardar PDF
               </button>
            </div>
         </div>

         {/* Factura Layout */}
         <div className="mx-auto max-w-4xl border border-slate-300 bg-white p-10 pt-14 shadow-2xl print:shadow-none print:border-none print:p-0 print:pt-10 rounded-[2rem] print:rounded-none overflow-hidden relative">
            
            {/* Marca de agua / Decoración */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none print:hidden">
               <FileText size={200} />
            </div>

            {/* Cabecera */}
            <div className="flex border-2 border-slate-900 relative">
               <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 flex h-16 w-16 items-center justify-center border-2 border-slate-900 bg-white text-4xl font-black z-10 shadow-sm">
                  {budget.afip_comprobante_tipo === 1 ? 'A' : (budget.afip_comprobante_tipo === 11 ? 'C' : 'B')}
               </div>

               <div className="flex-1 p-6 border-r-2 border-slate-900 bg-slate-50/30">
                  <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">{company?.name || 'ZOMA TEST'}</h2>
                  <div className="mt-4 space-y-1 text-xs font-bold text-slate-600">
                     <p>Razón Social: {company?.name}</p>
                     <p>Domicilio: {company?.address || 'Calle Falsa 123, Buenos Aires'}</p>
                     <p>Condición frente al IVA: Responsable Inscripto</p>
                  </div>
               </div>

               <div className="w-20 flex flex-col items-center justify-end pb-4 bg-white">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cod. {String(budget.afip_comprobante_tipo).padStart(3, '0')}</p>
               </div>

               <div className="flex-1 p-6 border-l-2 border-slate-900 bg-slate-50/30">
                  <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">Factura</h2>
                  <div className="mt-4 space-y-1 text-sm font-black text-slate-900">
                     <p>Punto de Venta: 00002</p>
                     <p>Comp. Nro: {String(budget.afip_comprobante_numero).padStart(8, '0')}</p>
                     <p>Fecha: {new Date(budget.budget_date).toLocaleDateString('es-AR')}</p>
                     <div className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        <p>CUIT: {company?.cuit || '20-41288612-8'}</p>
                        <p>Ingresos Brutos: {company?.cuit}</p>
                        <p>Inicio de Actividades: 01/01/2024</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Datos del Receptor */}
            <div className="mt-4 rounded-none border-2 border-slate-900 p-4 bg-slate-50/10">
               <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs font-bold text-slate-800">
                  <p><span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Apellido y Nombre / Razón Social:</span> {client?.name}</p>
                  <p><span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">CUIT:</span> {client?.cuit || 'Consumidor Final'}</p>
                  <p><span className="text-slate-400 font-black uppercase mr-2 tracking-tighter">Condición IVA:</span> {budget.afip_comprobante_tipo === 1 ? 'Responsable Inscripto' : 'Consumidor Final'}</p>
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
                     {items.map((item: any, idx: number) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                           <td className="px-4 py-2.5">{item.product_code ? `[${item.product_code}] ` : ''}{item.product_name}</td>
                           <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                           <td className="px-4 py-2.5 uppercase text-slate-500">Unid.</td>
                           <td className="px-4 py-2.5 text-right">${Number(item.unit_price).toLocaleString('es-AR')}</td>
                           <td className="px-4 py-2.5 text-right font-black">${(item.quantity * item.unit_price).toLocaleString('es-AR')}</td>
                        </tr>
                     ))}
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
                     <p className="flex items-center gap-2 mb-2 bg-slate-900 text-white px-2 py-1 w-fit rounded">
                        <img src="https://www.afip.gob.ar/images/logo_afip.png" className="h-3 brightness-0 invert" alt="AFIP" />
                        Comprobante Autorizado
                     </p>
                     <p>CAE: <span className="font-black text-base ml-1 tracking-tighter text-indigo-600">{budget.afip_cae}</span></p>
                     <p>Vencimiento CAE: {new Date(budget.afip_cae_vencimiento).toLocaleDateString('es-AR')}</p>
                  </div>
               </div>

               <div className="w-64 border-2 border-slate-900 bg-slate-50/50">
                  <div className="p-4 space-y-2 text-sm">
                     {budget.afip_comprobante_tipo === 1 ? (
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
