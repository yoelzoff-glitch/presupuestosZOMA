'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Receipt, Search, RefreshCw, Eye, User, DollarSign,
  CheckCircle2, XCircle, Loader2, Clock3, FileText,
  Printer, ShieldCheck, MoreVertical, Trash2, Send, Lock, Sparkles, MessageSquare,
  FileMinus, FilePlus
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import InvoicePreviewModal from '@/app/components/InvoicePreviewModal'

type Factura = {
  id: string
  invoice_number: number
  invoice_date: string
  status: 'draft' | 'emitted' | 'cancelled'
  total_amount: number
  afip_cae?: string | null
  afip_comprobante_numero?: number | null
  afip_comprobante_tipo?: number | null
  created_at: string
  client: { name: string; cuit: string } | null
  budget_id?: string | null
  budget?: { budget_code: string; budget_number: number } | null
}

type Props = {
  facturasIniciales: Factura[]
  idEmpresa: string
  planType?: string
}

export default function FacturasClient({ facturasIniciales, idEmpresa, planType = 'base' }: Props) {
  const [facturas, setFacturas] = useState<Factura[]>(facturasIniciales)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'all' | 'draft' | 'emitted'>('all')
  const [filtroTiempo, setFiltroTiempo] = useState<number | 'all' | 'month' | 'custom'>('month') // Mes vigente por defecto
  const [cargando, setCargando] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const [fechaDesdeCustom, setFechaDesdeCustom] = useState('')
  const [fechaHastaCustom, setFechaHastaCustom] = useState('')
  const [modalPreview, setModalPreview] = useState<{
    isOpen: boolean;
    budgetId: string | null;
    clientName: string;
    totalAmount: number;
  }>({
    isOpen: false,
    budgetId: null,
    clientName: '',
    totalAmount: 0
  })

  const [modalConfirmacion, setModalConfirmacion] = useState<{
    isOpen: boolean;
    tipo: 'credito' | 'debito' | null;
    factura: Factura | null;
  }>({
    isOpen: false,
    tipo: null,
    factura: null
  })

  async function cargarFacturas(
    dias: number | 'all' | 'month' | 'custom' = filtroTiempo,
    customDesde = fechaDesdeCustom,
    customHasta = fechaHastaCustom
  ) {
    setCargando(true)
    
    let query = supabase
      .from('invoices')
      .select(`
        *,
        client:clients ( name, cuit ),
        budget:budgets ( budget_code, budget_number )
      `)
      .eq('company_id', idEmpresa)
      .order('created_at', { ascending: false })

    if (dias === 'custom') {
      if (customDesde) {
        query = query.gte('invoice_date', customDesde)
      }
      if (customHasta) {
        query = query.lte('invoice_date', customHasta)
      }
    } else if (dias !== 'all') {
      const fechaLimite = new Date()
      if (dias === 'month') {
        fechaLimite.setDate(1)
        fechaLimite.setHours(0, 0, 0, 0)
      } else {
        fechaLimite.setDate(fechaLimite.getDate() - (dias as number))
      }
      query = query.gte('created_at', fechaLimite.toISOString())
    }

    const { data, error } = await query

    if (error) toast.error('Error al cargar facturas')
    else setFacturas(data || [])
    setCargando(false)
  }

  const cambiarFiltroTiempo = (nuevoRango: number | 'all' | 'month' | 'custom') => {
    setFiltroTiempo(nuevoRango)
    if (nuevoRango !== 'custom') {
      cargarFacturas(nuevoRango)
    }
  }

  useEffect(() => {
    if (filtroTiempo === 'custom') {
      cargarFacturas('custom', fechaDesdeCustom, fechaHastaCustom)
    }
  }, [fechaDesdeCustom, fechaHastaCustom])

  async function exportarIvaDigital() {
    setExportando(true)
    try {
      let fechaHasta = new Date().toISOString().split('T')[0]
      let fechaDesde = ''
      
      const hoy = new Date()
      if (filtroTiempo === 'month') {
        hoy.setDate(1)
        fechaDesde = hoy.toISOString().split('T')[0]
      } else if (filtroTiempo === 'all') {
        fechaDesde = `${hoy.getFullYear()}-01-01`
      } else if (filtroTiempo === 'custom') {
        if (!fechaDesdeCustom || !fechaHastaCustom) {
          throw new Error('Por favor selecciona los campos "Desde" y "Hasta" para exportar.')
        }
        fechaDesde = fechaDesdeCustom
        fechaHasta = fechaHastaCustom
      } else {
        const dias = Number(filtroTiempo)
        hoy.setDate(hoy.getDate() - dias)
        fechaDesde = hoy.toISOString().split('T')[0]
      }

      const response = await fetch('/api/reports/libro-iva-digital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: idEmpresa,
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta
        })
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al generar los reportes')
      }

      if (!data.cabecera && !data.alicuotas) {
        toast.info('No hay facturas legalizadas en el período seleccionado para exportar.')
        return
      }

      // Descargar Ventas.txt
      const blobCabecera = new Blob([data.cabecera], { type: 'text/plain;charset=utf-8' })
      const linkCabecera = document.createElement('a')
      linkCabecera.href = URL.createObjectURL(blobCabecera)
      linkCabecera.download = `REGINFO_CV_VENTAS_${fechaDesde.replace(/-/g, '')}_A_${fechaHasta.replace(/-/g, '')}.txt`
      linkCabecera.click()

      // Descargar Alicuotas.txt
      const blobAlicuotas = new Blob([data.alicuotas], { type: 'text/plain;charset=utf-8' })
      const linkAlicuotas = document.createElement('a')
      linkAlicuotas.href = URL.createObjectURL(blobAlicuotas)
      linkAlicuotas.download = `REGINFO_CV_ALICUOTAS_${fechaDesde.replace(/-/g, '')}_A_${fechaHasta.replace(/-/g, '')}.txt`
      linkAlicuotas.click()

      toast.success('¡Libro de IVA Digital descargado con éxito! Compartilo con tu contador.')
    } catch (err: any) {
      toast.error('Error al exportar: ' + err.message)
    } finally {
      setExportando(false)
    }
  }

  async function eliminarBorrador(id: string) {
    if (!confirm('¿Estás seguro de que querés eliminar este borrador? Esta acción no se puede deshacer.')) return

    setProcesandoId(id)
    try {
      console.log('Solicitando eliminación permanente del borrador:', id)
      
      const response = await fetch('/api/invoices/delete-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Fallo en la eliminación')

      toast.success('Borrador eliminado permanentemente')
      setFacturas(facturas.filter(f => f.id !== id))
    } catch (error: any) {
      console.error('Error al eliminar borrador:', error)
      toast.error('No se pudo eliminar: ' + error.message)
    } finally {
      setProcesandoId(null)
      setMenuAbierto(null)
    }
  }

  async function legalizarFactura(id: string, cbteTipoOverride?: number) {
    setProcesandoId(id)
    try {
      const response = await fetch('/api/afip/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          budget_id: id,
          cbteTipoOverride
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('¡Factura legalizada con éxito!')
        cargarFacturas()
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    } finally {
      setProcesandoId(null)
    }
  }

  const facturasFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return facturas.filter(f => {
      const coincideBusqueda = !q || f.client?.name?.toLowerCase().includes(q) || String(f.afip_comprobante_numero).includes(q)
      const coincideEstado = filtroEstado === 'all' || f.status === filtroEstado
      return coincideBusqueda && coincideEstado
    })
  }, [facturas, busqueda, filtroEstado])

  useEffect(() => {
    setCurrentPage(1)
  }, [busqueda, filtroEstado, filtroTiempo])

  const totalPages = Math.ceil(facturasFiltradas.length / itemsPerPage)
  const paginatedFacturas = facturasFiltradas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )



  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-200">
              <Receipt size={14} /> Facturación
            </div>
            <h1 className="text-3xl font-black tracking-tight">Gestión de Facturas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Administra tus comprobantes, borradores y autorizaciones de ARCA.</p>
          </div>
          <button
            onClick={exportarIvaDigital}
            disabled={exportando}
            className="inline-flex items-center gap-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-98 transition text-white px-5 py-3.5 text-xs font-black uppercase tracking-wider border border-white/10 shadow-lg disabled:opacity-50 shrink-0 self-start lg:self-center"
          >
            {exportando ? (
              <>
                <Loader2 size={15} className="animate-spin text-indigo-300" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <FileText size={15} className="text-indigo-300" />
                <span>Exportar IVA Digital (AFIP)</span>
              </>
            )}
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <TarjetaEstado titulo="Total Facturado" valor={`$${facturas.filter(f => f.status === 'emitted').reduce((acc, f) => acc + f.total_amount, 0).toLocaleString('es-AR')}`} icon={DollarSign} color="indigo" />
        <TarjetaEstado titulo="Borradores" valor={facturas.filter(f => f.status === 'draft').length} icon={Clock3} color="amber" />
        <TarjetaEstado titulo="Legalizadas" valor={facturas.filter(f => f.status === 'emitted').length} icon={ShieldCheck} color="emerald" />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="space-y-4 border-b border-slate-200 p-5 bg-slate-50/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row w-full lg:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por cliente o número..."
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-2">
              <button 
                onClick={() => cargarFacturas()} 
                className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition"
                title="Actualizar lista"
              >
                <RefreshCw size={17} className={cargando ? 'animate-spin' : ''} />
              </button>
            </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
                {[
                  { label: 'Mes Vigente', value: 'month' },
                  { label: '7D', value: 7 },
                  { label: '14D', value: 14 },
                  { label: '30D', value: 30 },
                  { label: '60D', value: 60 },
                  { label: 'Todo', value: 'all' },
                  { label: 'Personalizado 📅', value: 'custom' }
                ].map((r) => (
                  <button
                    key={r.label}
                    onClick={() => cambiarFiltroTiempo(r.value as any)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition ${filtroTiempo === r.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block" />
              <button onClick={() => setFiltroEstado('all')} className={`px-4 py-2 rounded-full text-xs font-black transition ${filtroEstado === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Todas</button>
              <button onClick={() => setFiltroEstado('draft')} className={`px-4 py-2 rounded-full text-xs font-black transition ${filtroEstado === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>Borradores</button>
              <button onClick={() => setFiltroEstado('emitted')} className={`px-4 py-2 rounded-full text-xs font-black transition ${filtroEstado === 'emitted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>Legalizadas</button>
            </div>
          </div>
          {filtroTiempo === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-200/60 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400">Desde:</span>
                <input
                  type="date"
                  value={fechaDesdeCustom}
                  onChange={(e) => setFechaDesdeCustom(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400">Hasta:</span>
                <input
                  type="date"
                  value={fechaHastaCustom}
                  onChange={(e) => setFechaHastaCustom(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Nro. Factura</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Presupuesto</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedFacturas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400 font-bold italic">No se encontraron facturas</td>
                </tr>
              ) : paginatedFacturas.map(f => (
                <tr key={f.id} className="hover:bg-indigo-50/30 transition group">
                  <td className="px-6 py-4 text-sm font-black text-slate-900">
                    {f.status !== 'draft' ? (
                      <div className="flex flex-col">
                        <span>{String(f.afip_comprobante_numero).padStart(8, '0')}</span>
                        <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Pto. Venta 00002</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Sin numerar (Borrador)</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-700">{f.client?.name}</p>
                    <p className="text-[10px] font-bold text-slate-400">{f.client?.cuit}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                      <FileText size={10} /> {f.budget?.budget_code || `#${f.budget?.budget_number}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900">
                    {f.total_amount < 0 ? `-$${Math.abs(f.total_amount).toLocaleString('es-AR')}` : `$${f.total_amount.toLocaleString('es-AR')}`}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <EtiquetaEstado estado={f.status} tipoComprobante={f.afip_comprobante_tipo} monto={f.total_amount} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {f.status === 'draft' && (
                        <button
                          onClick={() => setModalPreview({
                            isOpen: true,
                            budgetId: f.budget_id || null,
                            clientName: f.client?.name || '',
                            totalAmount: f.total_amount
                          })}
                          disabled={!!procesandoId}
                          className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                          title="Legalizar en AFIP"
                        >
                          <Send size={16} />
                        </button>
                      )}
                      {f.status === 'emitted' && (
                        <Link
                          href={`/facturas/ver/${f.budget_id}`}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                          title="Ver / Imprimir"
                        >
                          <Printer size={18} />
                        </Link>
                      )}
                      <div className="relative">
                        <button 
                          onClick={() => setMenuAbierto(menuAbierto === f.id ? null : f.id)}
                          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {menuAbierto === f.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(null)} />
                            <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white p-2 shadow-xl border border-slate-100 z-20">
                              <Link
                                href={`/facturas/ver/${f.budget_id}`}
                                target="_blank"
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                              >
                                <Eye size={14} /> Previsualizar
                              </Link>
                              
                              {f.status === 'draft' && (
                                <button
                                  onClick={() => eliminarBorrador(f.id)}
                                  disabled={!!procesandoId}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                                >
                                  <Trash2 size={14} /> Eliminar Borrador
                                </button>
                              )}

                              {f.status === 'emitted' && (
                                <>
                                  <button
                                    onClick={() => window.open(`/facturas/ver/${f.budget_id}`, '_blank')}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                                  >
                                    <Printer size={14} /> Re-imprimir
                                  </button>
                                  {f.total_amount > 0 && [1, 6, 11].includes(f.afip_comprobante_tipo || 11) && (
                                    <>
                                      <div className="h-[1px] bg-slate-100 my-1" />
                                      <button
                                        onClick={() => {
                                          setMenuAbierto(null)
                                          setModalConfirmacion({ isOpen: true, tipo: 'credito', factura: f })
                                        }}
                                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                                      >
                                        <FileMinus size={14} /> Nota de Crédito
                                      </button>
                                      <button
                                        onClick={() => {
                                          setMenuAbierto(null)
                                          setModalConfirmacion({ isOpen: true, tipo: 'debito', factura: f })
                                        }}
                                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 transition"
                                      >
                                        <FilePlus size={14} /> Nota de Débito
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-white p-5">
              <span className="text-xs font-bold text-slate-500">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, facturasFiltradas.length)} de {facturasFiltradas.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="flex items-center justify-center rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <InvoicePreviewModal
        isOpen={modalPreview.isOpen}
        onClose={() => setModalPreview({ ...modalPreview, isOpen: false })}
        onConfirm={(tipo) => {
          setModalPreview({ ...modalPreview, isOpen: false })
          legalizarFactura(modalPreview.budgetId!, tipo)
        }}
        budgetId={modalPreview.budgetId || ''}
        clientName={modalPreview.clientName}
        totalAmount={modalPreview.totalAmount}
        isEmitting={!!procesandoId}
      />

      {modalConfirmacion.isOpen && modalConfirmacion.factura && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative overflow-hidden animate-scaleUp">
            
            {/* Header / Icon */}
            <div className="flex items-center gap-4 mb-6">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
                modalConfirmacion.tipo === 'credito' 
                  ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                  : 'bg-blue-50 text-blue-600 border border-blue-105'
              }`}>
                {modalConfirmacion.tipo === 'credito' ? <FileMinus size={22} /> : <FilePlus size={22} />}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Confirmar Nota de {modalConfirmacion.tipo === 'credito' ? 'Crédito' : 'Débito'}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Acción Oficial de AFIP / ARCA
                </p>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 mb-6 text-xs text-slate-650 leading-relaxed font-semibold">
              <p>
                Estás por emitir un comprobante oficial de corrección ante la AFIP por la Factura 
                <span className="font-black text-slate-900"> N° {String(modalConfirmacion.factura.afip_comprobante_numero).padStart(8, '0')}</span>.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200/60 pt-3 text-[10px] font-black uppercase tracking-wider text-slate-450">
                <div>
                  <span className="block text-slate-400">Cliente:</span>
                  <span className="text-slate-800 text-[11px] font-bold">{modalConfirmacion.factura.client?.name}</span>
                </div>
                <div>
                  <span className="block text-slate-400">Importe total:</span>
                  <span className="text-slate-800 text-[11px] font-bold">${modalConfirmacion.factura.total_amount.toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <p className="text-[10px] text-slate-450 font-bold leading-relaxed mb-8">
              ⚠️ Esta acción es irreversible. Se conectará con los servidores de ARCA en tiempo real y modificará la cuenta corriente del cliente.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setModalConfirmacion({ isOpen: false, tipo: null, factura: null })}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-xs font-bold text-slate-650 hover:bg-slate-50 transition active:scale-98"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const num = String(modalConfirmacion.factura?.afip_comprobante_numero).padStart(8, '0');
                  const tipo = modalConfirmacion.tipo === 'credito' ? 'Nota de Crédito' : 'Nota de Débito';
                  const facturaId = modalConfirmacion.factura?.id;
                  const isCredito = modalConfirmacion.tipo === 'credito';
                  
                  setModalConfirmacion({ isOpen: false, tipo: null, factura: null });
                  
                  // Ejecutar la autorización real llamando al backend oficial
                  toast.promise(
                    (async () => {
                      const response = await fetch('/api/afip/create-invoice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          budget_id: modalConfirmacion.factura?.budget_id,
                          isCreditNote: isCredito,
                          isDebitNote: !isCredito
                        })
                      });
                      
                      const result = await response.json();
                      if (!response.ok) throw new Error(result.error || 'Error al conectar con AFIP (ARCA)');
                      
                      // Recargar la lista completa de facturas desde la base de datos
                      await cargarFacturas();
                      
                      return result;
                    })(),
                    {
                      loading: `Conectando con ARCA y emitiendo ${tipo} oficial...`,
                      success: `¡${tipo} para la Factura N° ${num} autorizada con éxito en AFIP!`,
                      error: (err) => err.message || 'Error al conectar con AFIP.'
                    }
                  );
                }}
                className={`flex-1 rounded-2xl py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg transition active:scale-98 ${
                  modalConfirmacion.tipo === 'credito'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-950/15'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-950/15'
                }`}
              >
                Emitir Comprobante
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

function TarjetaEstado({ titulo, valor, icon: Icon, color }: { titulo: string; valor: number | string; icon: LucideIcon; color: 'indigo' | 'amber' | 'emerald' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  }
  return (
    <div className={`bg-white p-5 rounded-3xl border ${colors[color]} shadow-sm flex items-center gap-4`}>
      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${colors[color].replace('bg-', 'bg-opacity-50 bg-')}`}><Icon size={22} /></div>
      <div className="min-w-0"><p className="text-xs font-bold text-slate-400 truncate uppercase tracking-widest">{titulo}</p><h2 className="text-xl font-black text-slate-950 truncate">{valor}</h2></div>
    </div>
  )
}

function EtiquetaEstado({ estado, tipoComprobante, monto }: { estado: 'draft' | 'emitted' | 'cancelled'; tipoComprobante?: number | null; monto: number }) {
  const isCredit = tipoComprobante ? [3, 8, 13].includes(tipoComprobante) : monto < 0
  const isDebit = tipoComprobante ? [2, 7, 12].includes(tipoComprobante) : false

  if (estado === 'emitted') {
    if (isCredit) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border-rose-100">
          <FileMinus size={12} /> Nota de Crédito
        </span>
      )
    }
    if (isDebit) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border-blue-100">
          <FilePlus size={12} /> Nota de Débito
        </span>
      )
    }
  }

  const configs = {
    draft: { etiqueta: 'No emitida', icon: Clock3, className: 'bg-amber-50 text-amber-600 border-amber-100' },
    emitted: { etiqueta: 'Emitida', icon: ShieldCheck, className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    cancelled: { etiqueta: 'Anulada', icon: XCircle, className: 'bg-red-50 text-red-600 border-red-100' },
  }
  const config = configs[estado]
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${config.className}`}>
      <config.icon size={12} /> {config.etiqueta}
    </span>
  )
}
