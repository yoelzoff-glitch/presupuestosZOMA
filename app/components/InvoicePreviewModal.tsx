'use client'
import { X, FileText, User, Hash, Calendar, DollarSign, Loader2, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (tipoCbte: number, addIva: boolean, serviceDates?: { FchServDesde: string; FchServHasta: string; FchVtoPago: string }) => void
  budgetId: string
  clientName: string
  totalAmount: number
  isEmitting: boolean
}

export default function InvoicePreviewModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  budgetId, 
  clientName, 
  totalAmount,
  isEmitting 
}: Props) {
  const [items, setItems] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tipoCbte, setTipoCbte] = useState<number>(11)
  const [addIva, setAddIva] = useState(false)
  const [businessType, setBusinessType] = useState<string>('products')
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
    if (isOpen && budgetId) {
      setAddIva(false)
      setServiceDates(getInitialDates())
      fetchData()
    }
  }, [isOpen, budgetId])

  async function fetchData() {
    setLoading(true)
    try {
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*, clients(*), budget_items(*)')
        .eq('id', budgetId)
        .single()

      if (budgetData) {
        setItems(budgetData.budget_items || [])
        const cl = Array.isArray(budgetData.clients) ? budgetData.clients[0] : budgetData.clients
        setClient(cl)
        
        const { data: afipData } = await supabase
          .from('afip_configs')
          .select('*')
          .eq('company_id', budgetData.company_id)
          .single()
        
        setConfig(afipData)

        // Fetch company business type
        const { data: compData } = await supabase
          .from('companies')
          .select('business_type')
          .eq('id', budgetData.company_id)
          .single()
        
        setBusinessType(compData?.business_type || 'products')

        // Pre-seleccionar tipo
        if (afipData?.tipo_contribuyente === 'responsable_inscripto') {
           setTipoCbte(cl?.client_type === 'distribuidor' ? 1 : 6)
        } else {
           setTipoCbte(11)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const esRI = config?.tipo_contribuyente === 'responsable_inscripto'
  const condicionCliente = client?.client_type === 'distribuidor' ? 'Responsable Inscripto' : 'Consumidor Final'
  
  // Cálculos de IVA si es RI y eligió A o B
  // Nota: Factura B también tiene IVA aunque no se detalla en el PDF para el cliente
  const baseTotal = totalAmount
  const finalTotal = (esRI && (tipoCbte === 1 || tipoCbte === 6) && addIva) ? (baseTotal * 1.21) : baseTotal
  const neto = (esRI && (tipoCbte === 1 || tipoCbte === 6)) ? (finalTotal / 1.21) : finalTotal
  const iva = finalTotal - neto

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Vista Previa de Factura</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Borrador no válido como factura</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  <User size={12} /> Cliente
                </div>
                <p className="font-bold text-slate-900">{clientName}</p>
                <p className="text-xs text-slate-500 italic mt-1">Condición: {loading ? '...' : condicionCliente}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  <Calendar size={12} /> Fecha de Emisión
                </div>
                <p className="font-bold text-slate-900">{new Date().toLocaleDateString('es-AR')}</p>
                <p className="text-xs text-slate-500 italic mt-1">
                  Vencimiento: {businessType === 'services' && serviceDates.vto ? new Date(serviceDates.vto + 'T00:00:00').toLocaleDateString('es-AR') : 'Inmediato'}
                </p>
              </div>
            </div>
          </div>

          {/* Fechas de Servicio si es empresa de Servicios */}
          {businessType === 'services' && (
            <div className="mt-6 rounded-[2rem] border border-blue-100 bg-blue-50/20 p-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="text-blue-600" size={18} />
                <h5 className="text-xs font-black uppercase tracking-wider text-blue-900">Período de Facturación del Servicio</h5>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 mb-4 leading-normal">
                Al facturar servicios, la AFIP requiere definir el rango de fechas en el que se prestó el servicio y el vencimiento de la factura.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Servicio Desde</label>
                  <input
                    type="date"
                    value={serviceDates.desde}
                    onChange={(e) => setServiceDates({ ...serviceDates, desde: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Servicio Hasta</label>
                  <input
                    type="date"
                    value={serviceDates.hasta}
                    onChange={(e) => setServiceDates({ ...serviceDates, hasta: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Vencimiento Pago</label>
                  <input
                    type="date"
                    value={serviceDates.vto}
                    onChange={(e) => setServiceDates({ ...serviceDates, vto: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Selector de Tipo de Factura */}
          <div className="mt-8 rounded-[2rem] border border-slate-100 bg-slate-50/30 p-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-2">Tipo de Comprobante</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 1, label: 'Factura A', disabled: !esRI },
                { id: 6, label: 'Factura B', disabled: !esRI },
                { id: 11, label: 'Factura C', disabled: esRI }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={t.disabled || loading}
                  onClick={() => setTipoCbte(t.id)}
                  className={`
                    flex flex-col items-center gap-1 rounded-2xl py-4 px-2 transition-all border-2
                    ${t.disabled ? 'opacity-30 cursor-not-allowed bg-slate-100 border-transparent grayscale' : 
                      tipoCbte === t.id ? 'bg-indigo-600 border-indigo-200 text-white shadow-xl shadow-indigo-100' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'}
                  `}
                >
                  <span className="text-xl font-black">{t.label.split(' ')[1]}</span>
                  <span className="text-[9px] font-bold uppercase tracking-tight opacity-80">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toggle para Sumar IVA si es RI y emite A o B */}
          {esRI && (tipoCbte === 1 || tipoCbte === 6) && (
            <div className="mt-6 rounded-[2rem] border border-blue-100 bg-blue-50/20 p-5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h5 className="text-xs font-black uppercase tracking-wider text-blue-900">¿Sumar 21% de IVA al Facturar?</h5>
                  <p className="text-[11px] font-semibold text-slate-500 leading-normal max-w-[380px]">
                    Activalo si el presupuesto original fue enviado en montos Netos (Sin IVA) para que el sistema le sume el 21% automáticamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddIva(!addIva)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    addIva ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      addIva ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-4 py-3">Detalle</th>
                  <th className="px-4 py-3 text-center">Cant.</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center">
                      <Loader2 className="mx-auto animate-spin text-blue-600 mb-2" />
                      <p className="text-xs font-bold text-slate-500">Cargando detalles...</p>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400 font-medium italic">
                      No hay items en este presupuesto
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const price = (esRI && (tipoCbte === 1 || tipoCbte === 6) && addIva) ? (item.unit_price * 1.21) : item.unit_price;
                    return (
                      <tr key={idx} className="text-xs font-semibold text-slate-700">
                        <td className="px-4 py-3">{item.product_name}</td>
                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">${Number(price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">${(item.quantity * price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Total Box */}
          <div className="mt-6 flex flex-col items-end gap-2">
            <div className="flex w-full max-w-[200px] items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs font-bold text-slate-500 uppercase">{(tipoCbte === 1 || tipoCbte === 6) ? 'Neto' : 'Subtotal'}</span>
              <span className="text-sm font-bold text-slate-900">${neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex w-full max-w-[200px] items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">IVA ({(tipoCbte === 1 || tipoCbte === 6) ? '21%' : '0%'})</span>
              <span className="text-sm font-bold text-slate-900">${iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="mt-2 flex w-full max-w-[240px] items-center justify-between rounded-2xl bg-blue-600 p-4 text-white shadow-xl shadow-blue-100">
              <div className="flex items-center gap-2">
                <DollarSign size={18} />
                <span className="text-sm font-black uppercase tracking-tight">Total ARCA</span>
              </div>
              <span className="text-xl font-black">${finalTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 p-4 flex gap-3">
             <div className="h-10 w-10 shrink-0 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-black">!</div>
             <div>
                <p className="text-xs font-black text-amber-900 uppercase tracking-tight">Atención: Acción Irreversible</p>
                <p className="text-xs text-amber-800 leading-relaxed mt-0.5">Al hacer clic en "Confirmar", se generará un comprobante legal ante AFIP que impactará en tu facturación mensual.</p>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 bg-slate-50/50 px-8 py-6">
          <button 
            onClick={onClose}
            disabled={isEmitting}
            className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button 
            onClick={() => onConfirm(
              tipoCbte, 
              addIva, 
              businessType === 'services' 
                ? { FchServDesde: serviceDates.desde, FchServHasta: serviceDates.hasta, FchVtoPago: serviceDates.vto } 
                : undefined
            )}
            disabled={isEmitting || loading}
            className="flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-500 active:scale-95 disabled:opacity-50"
          >
            {isEmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
            Confirmar y Emitir Factura
          </button>
        </div>
      </div>
    </div>
  )
}
