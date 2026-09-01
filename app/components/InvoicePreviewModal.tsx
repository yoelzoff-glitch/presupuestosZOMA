'use client'
import { X, FileText, User, Calendar, DollarSign, Loader2, CheckCircle2, ShieldAlert, ShieldCheck, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface FiscalConfigResponse {
  configured: boolean
  environment: 'homo' | 'prod'
  cuit: string
  punto_venta: number
  tipo_contribuyente: 'monotributo' | 'responsable_inscripto' | 'exento'
  verified_at: string | null
  certificate_fingerprint: string | null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (
    tipoCbte: number,
    addIva: boolean,
    environment: 'homo' | 'prod',
    serviceDates?: { FchServDesde: string; FchServHasta: string; FchVtoPago: string }
  ) => void
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
  const [environment, setEnvironment] = useState<'homo' | 'prod' | null>(null)
  const [fiscalMetadata, setFiscalMetadata] = useState<FiscalConfigResponse | null>(null)
  const [fiscalLoading, setFiscalLoading] = useState(false)
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tipoCbte, setTipoCbte] = useState<number>(11)
  const [addIva, setAddIva] = useState(false)
  const [businessType, setBusinessType] = useState<string>('products')
  const [prodConfirmed, setProdConfirmed] = useState(false)
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
      setEnvironment(null)
      setFiscalMetadata(null)
      setProdConfirmed(false)
      setAddIva(false)
      setServiceDates(getInitialDates())
      fetchBudgetData()
    }
  }, [isOpen, budgetId])

  useEffect(() => {
    if (environment) {
      fetchFiscalConfig(environment)
    } else {
      setFiscalMetadata(null)
    }
  }, [environment])

  async function fetchFiscalConfig(env: 'homo' | 'prod') {
    setFiscalLoading(true)
    try {
      const res = await fetch(`/api/afip/config?environment=${env}`)
      if (!res.ok) throw new Error('Error al consultar configuración fiscal')
      const data: FiscalConfigResponse = await res.json()

      setFiscalMetadata(data)
      if (data.tipo_contribuyente === 'responsable_inscripto') {
        const rawCond = (client?.condicion_iva || '').toLowerCase()
        setTipoCbte(rawCond === 'responsable_inscripto' ? 1 : 6)
      } else {
        setTipoCbte(11)
      }
    } catch (err) {
      console.error('Error fetching fiscal config:', err)
      setFiscalMetadata(null)
    } finally {
      setFiscalLoading(false)
    }
  }

  async function fetchBudgetData() {
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

        const { data: compData } = await supabase
          .from('companies')
          .select('business_type')
          .eq('id', budgetData.company_id)
          .single()

        setBusinessType(compData?.business_type || 'products')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const esRI = fiscalMetadata?.tipo_contribuyente === 'responsable_inscripto'
  const cuitLimpio = (client?.cuit || '').replace(/[-_ ]/g, '').trim()
  const rawCondIva = (client?.condicion_iva || '').toLowerCase()
  const esReceptorRI = rawCondIva === 'responsable_inscripto'

  let condicionLabel = 'Consumidor Final'
  if (rawCondIva === 'responsable_inscripto') condicionLabel = 'Responsable Inscripto'
  else if (rawCondIva === 'monotributo') condicionLabel = 'Monotributista'
  else if (rawCondIva === 'exento') condicionLabel = 'Exento'

  const baseTotal = totalAmount
  const finalTotal = (esRI && (tipoCbte === 1 || tipoCbte === 6) && addIva) ? (baseTotal * 1.21) : baseTotal
  const neto = (esRI && (tipoCbte === 1 || tipoCbte === 6)) ? (finalTotal / 1.21) : finalTotal
  const iva = finalTotal - neto

  const isFacturaAInvalid = tipoCbte === 1 && (!esReceptorRI || cuitLimpio.length !== 11)

  const isProdBlocked = environment === 'prod' && (
    !fiscalMetadata?.configured ||
    !fiscalMetadata?.verified_at ||
    !prodConfirmed
  )

  const canConfirm = Boolean(
    environment &&
    fiscalMetadata &&
    !fiscalLoading &&
    !loading &&
    !isEmitting &&
    !isFacturaAInvalid &&
    !isProdBlocked
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-lg ${
              environment === 'prod' ? 'bg-emerald-600 shadow-emerald-200' : 'bg-blue-600 shadow-blue-200'
            }`}>
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Emisión de Factura ARCA</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {environment === 'prod' ? 'Entorno: Producción (Fiscal Real)' : (environment === 'homo' ? 'Entorno: Homologación (Prueba)' : 'Seleccione el entorno fiscal')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-8 space-y-6">

          {/* Selector de Entorno (OBLIGATORIO - SIN DEFAULT SILENCIOSO) */}
          <div className="rounded-[2rem] border-2 border-slate-200 bg-slate-50/80 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
              1. Seleccione el Entorno de Emisión *
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEnvironment('homo')}
                className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-black transition border-2 ${
                  environment === 'homo'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <ShieldCheck size={16} /> Homologación (Testing)
              </button>
              <button
                type="button"
                onClick={() => setEnvironment('prod')}
                className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-black transition border-2 ${
                  environment === 'prod'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <ShieldAlert size={16} /> Producción (Oficial)
              </button>
            </div>

            {/* Avisos de Configuración para Producción */}
            {environment === 'prod' && (
              <div className="mt-4 space-y-3">
                {fiscalLoading ? (
                  <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-xl text-xs text-slate-600 font-bold">
                    <Loader2 size={15} className="animate-spin text-emerald-600" /> Verificando credenciales productivas...
                  </div>
                ) : !fiscalMetadata?.configured ? (
                  <div className="p-3.5 bg-red-50 rounded-xl border border-red-200 flex items-start gap-2.5">
                    <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={16} />
                    <div>
                      <p className="text-xs font-black text-red-900">Producción No Configurada</p>
                      <p className="text-xs text-red-700 mt-0.5">
                        Debe cargar los certificados y punto de venta de Producción en Configuración Fiscal antes de emitir.
                      </p>
                    </div>
                  </div>
                ) : !fiscalMetadata?.verified_at ? (
                  <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5">
                    <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                    <div>
                      <p className="text-xs font-black text-amber-900">Producción No Validada</p>
                      <p className="text-xs text-amber-800 mt-0.5">
                        Debe presionar "Probar Conexión (PROD)" en Configuración Fiscal para habilitar la emisión real.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      Credenciales Validadas ({new Date(fiscalMetadata.verified_at).toLocaleString('es-AR')})
                    </div>
                    {fiscalMetadata.certificate_fingerprint && (
                      <p className="text-[10px] font-mono text-emerald-700 mt-1">
                        Fingerprint: {fiscalMetadata.certificate_fingerprint}
                      </p>
                    )}
                  </div>
                )}

                {/* Confirmación explícita para Producción */}
                {fiscalMetadata?.configured && fiscalMetadata?.verified_at && (
                  <label className="flex items-start gap-3 p-3.5 bg-amber-50 rounded-xl border border-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodConfirmed}
                      onChange={(e) => setProdConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-amber-900 leading-snug">
                      Confirmo que deseo emitir un comprobante fiscal legal definitivo en ARCA Producción con impacto tributario real.
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Información Receptor & Emisor */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  <User size={12} /> Cliente Receptor
                </div>
                <p className="font-bold text-slate-900">{clientName}</p>
                <p className="text-xs text-slate-500 mt-1">CUIT/DNI: {cuitLimpio || 'Sin identificar'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Condición IVA: <span className="font-bold text-slate-700">{condicionLabel}</span></p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  <Calendar size={12} /> Emisor & Punto de Venta
                </div>
                <p className="font-bold text-slate-900">CUIT: {fiscalMetadata?.cuit || '---'}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Punto de Venta: <span className="font-bold text-slate-700">{fiscalMetadata ? fiscalMetadata.punto_venta : '---'}</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Fecha: {new Date().toLocaleDateString('es-AR')}</p>
              </div>
            </div>
          </div>

          {/* Fechas de Servicio si es empresa de Servicios */}
          {businessType === 'services' && (
            <div className="rounded-[2rem] border border-blue-100 bg-blue-50/20 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="text-blue-600" size={18} />
                <h5 className="text-xs font-black uppercase tracking-wider text-blue-900">Período de Facturación del Servicio</h5>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Servicio Desde</label>
                  <input
                    type="date"
                    value={serviceDates.desde}
                    onChange={(e) => setServiceDates({ ...serviceDates, desde: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Servicio Hasta</label>
                  <input
                    type="date"
                    value={serviceDates.hasta}
                    onChange={(e) => setServiceDates({ ...serviceDates, hasta: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Vencimiento Pago</label>
                  <input
                    type="date"
                    value={serviceDates.vto}
                    onChange={(e) => setServiceDates({ ...serviceDates, vto: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Selector de Tipo de Factura */}
          <div className="rounded-[2rem] border border-slate-100 bg-slate-50/30 p-6">
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
                  disabled={t.disabled || loading || !environment}
                  onClick={() => setTipoCbte(t.id)}
                  className={`
                    flex flex-col items-center gap-1 rounded-2xl py-4 px-2 transition-all border-2
                    ${t.disabled || !environment ? 'opacity-30 cursor-not-allowed bg-slate-100 border-transparent grayscale' :
                      tipoCbte === t.id ? 'bg-indigo-600 border-indigo-200 text-white shadow-xl shadow-indigo-100' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'}
                  `}
                >
                  <span className="text-xl font-black">{t.label.split(' ')[1]}</span>
                  <span className="text-[9px] font-bold uppercase tracking-tight opacity-80">{t.label}</span>
                </button>
              ))}
            </div>

            {isFacturaAInvalid && (
              <p className="mt-3 text-xs font-bold text-red-600">
                Para emitir Factura A, el cliente debe ser Responsable Inscripto y poseer un CUIT válido de 11 dígitos.
              </p>
            )}
          </div>

          {/* Toggle para Sumar IVA si es RI y emite A o B */}
          {esRI && (tipoCbte === 1 || tipoCbte === 6) && (
            <div className="rounded-[2rem] border border-blue-100 bg-blue-50/20 p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h5 className="text-xs font-black uppercase tracking-wider text-blue-900">¿Sumar 21% de IVA al Facturar?</h5>
                  <p className="text-[11px] font-semibold text-slate-500 max-w-[380px]">
                    Activalo si el presupuesto original fue cargado en valores Netos (sin IVA).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddIva(!addIva)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    addIva ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${addIva ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}

          {/* Resumen Final de Confirmación */}
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-5 space-y-2">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">Resumen Fiscal de Emisión:</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold text-slate-600">
              <p>Entorno: <span className="text-slate-900 uppercase font-black">{environment || 'NO SELECCIONADO'}</span></p>
              <p>CUIT Emisor: <span className="text-slate-900">{fiscalMetadata?.cuit || '---'}</span></p>
              <p>Punto Venta: <span className="text-slate-900">{fiscalMetadata ? fiscalMetadata.punto_venta : '---'}</span></p>
              <p>Comprobante: <span className="text-slate-900 font-black">{tipoCbte === 1 ? 'Factura A' : (tipoCbte === 6 ? 'Factura B' : 'Factura C')}</span></p>
              <p>Condición Receptor: <span className="text-slate-900">{condicionLabel}</span></p>
              <p>Total ARCA: <span className="text-slate-900 font-black">${finalTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></p>
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
            onClick={() => {
              if (environment) {
                onConfirm(
                  tipoCbte,
                  addIva,
                  environment,
                  businessType === 'services'
                    ? { FchServDesde: serviceDates.desde, FchServHasta: serviceDates.hasta, FchVtoPago: serviceDates.vto }
                    : undefined
                )
              }
            }}
            disabled={!canConfirm}
            className={`flex items-center gap-2 rounded-2xl px-8 py-3 text-sm font-black text-white shadow-lg transition active:scale-95 disabled:opacity-50 ${
              environment === 'prod'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-200'
            }`}
          >
            {isEmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
            {environment ? `Confirmar y Emitir en ${environment.toUpperCase()}` : 'Seleccione Entorno'}
          </button>
        </div>
      </div>
    </div>
  )
}
