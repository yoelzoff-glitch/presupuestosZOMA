'use client'
import { X, FileText, User, Hash, Calendar, DollarSign, Loader2, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
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

  useEffect(() => {
    if (isOpen && budgetId) {
      fetchData()
    }
  }, [isOpen, budgetId])

  async function fetchData() {
    setLoading(true)
    try {
      // Fetch items, budget (with client) and afip config
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*, clients(*), budget_items(*)')
        .eq('id', budgetId)
        .single()

      if (budgetData) {
        setItems(budgetData.budget_items || [])
        setClient(Array.isArray(budgetData.clients) ? budgetData.clients[0] : budgetData.clients)
        
        // Fetch AFIP config for this company
        const { data: afipData } = await supabase
          .from('afip_configs')
          .select('*')
          .eq('company_id', budgetData.company_id)
          .single()
        
        setConfig(afipData)
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
  
  // Cálculos de IVA si es RI
  const neto = esRI ? (totalAmount / 1.21) : totalAmount
  const iva = totalAmount - neto

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
            {/* Info Emisión */}
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
                <p className="text-xs text-slate-500 italic mt-1">Vencimiento: Inmediato</p>
              </div>
            </div>
          </div>

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
                  items.map((item, idx) => (
                    <tr key={idx} className="text-xs font-semibold text-slate-700">
                      <td className="px-4 py-3">{item.product_name}</td>
                      <td className="px-4 py-3 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">${Number(item.unit_price).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">${(item.quantity * item.unit_price).toLocaleString('es-AR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Total Box */}
          <div className="mt-6 flex flex-col items-end gap-2">
            <div className="flex w-full max-w-[200px] items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs font-bold text-slate-500 uppercase">{esRI ? 'Neto' : 'Subtotal'}</span>
              <span className="text-sm font-bold text-slate-900">${neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex w-full max-w-[200px] items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">IVA ({esRI ? '21%' : '0%'})</span>
              <span className="text-sm font-bold text-slate-900">${iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="mt-2 flex w-full max-w-[240px] items-center justify-between rounded-2xl bg-blue-600 p-4 text-white shadow-xl shadow-blue-100">
              <div className="flex items-center gap-2">
                <DollarSign size={18} />
                <span className="text-sm font-black uppercase tracking-tight">Total ARCA</span>
              </div>
              <span className="text-xl font-black">${totalAmount.toLocaleString('es-AR')}</span>
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
            onClick={onConfirm}
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
