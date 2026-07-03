'use client'

import { useState, useMemo } from 'react'
import {
  BookOpen,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/formatCurrency'
import { toast } from 'sonner'

type LedgerEntry = {
  id: string
  company_id: string
  entry_date: string
  entry_type: 'ingreso' | 'egreso'
  concept: string
  amount: number
  payment_method: string | null
  created_at: string
  source_table: string
  source_id: string
}

type Props = {
  entriesIniciales: LedgerEntry[]
  totalDeudaPasivaInicial: number
  idEmpresa: string
}

export default function LibroDiarioClient({
  entriesIniciales,
  totalDeudaPasivaInicial,
  idEmpresa,
}: Props) {
  const [entries, setEntries] = useState<LedgerEntry[]>(entriesIniciales)
  const [totalDeudaPasiva, setTotalDeudaPasiva] = useState(totalDeudaPasivaInicial)
  const [cargando, setCargando] = useState(false)

  // Filtros
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'egreso'>('todos')
  const [filtroRango, setFiltroRango] = useState<'30' | '90' | '365' | 'todos'>('30')
  const [paginaActual, setPaginaActual] = useState(1)

  // Actualizar datos desde Supabase
  async function actualizarDatos() {
    setCargando(true)
    try {
      // 1. Recargar entradas
      const { data: ent, error: entErr } = await supabase
        .from('v_ledger_entries')
        .select('*')
        .eq('company_id', idEmpresa)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000)

      if (entErr) throw entErr
      setEntries(ent || [])

      // 2. Recargar deuda pasiva
      const { data: purchasesPending, error: purErr } = await supabase
        .from('purchases')
        .select('total_cost, amount_paid')
        .eq('company_id', idEmpresa)
        .eq('payment_status', 'pending')

      if (purErr) throw purErr

      const deuda = (purchasesPending || []).reduce((acc, curr) => {
        const total = curr.total_cost || 0
        const pagado = curr.amount_paid || 0
        return acc + (total - pagado)
      }, 0)

      setTotalDeudaPasiva(deuda)
      toast.success('Datos actualizados.')
    } catch (err: any) {
      toast.error('Error al actualizar datos: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  // Filtrado lógico de entradas
  const entriesFiltradas = useMemo(() => {
    return entries.filter(e => {
      // 1. Filtro por tipo (ingreso/egreso)
      if (filtroTipo !== 'todos' && e.entry_type !== filtroTipo) {
        return false
      }

      // 2. Filtro por rango de fecha
      if (filtroRango !== 'todos') {
        const limiteDias = Number(filtroRango)
        const fechaLimite = new Date()
        fechaLimite.setDate(fechaLimite.getDate() - limiteDias)
        const fechaEntrada = new Date(e.entry_date)
        if (fechaEntrada < fechaLimite) {
          return false
        }
      }

      // 3. Filtro por búsqueda de texto
      const q = filtroBusqueda.toLowerCase().trim()
      if (q) {
        const conceptoMatches = e.concept.toLowerCase().includes(q)
        const metodoMatches = (e.payment_method || '').toLowerCase().includes(q)
        if (!conceptoMatches && !metodoMatches) {
          return false
        }
      }

      return true
    })
  }, [entries, filtroTipo, filtroRango, filtroBusqueda])

  // Cálculo dinámico de métricas del Balance basadas en las entradas filtradas
  const balanceMetrics = useMemo(() => {
    let ingresos = 0
    let egresos = 0

    entriesFiltradas.forEach(e => {
      if (e.entry_type === 'ingreso') {
        ingresos += e.amount
      } else {
        egresos += e.amount
      }
    })

    return {
      totalIngresos: ingresos,
      totalEgresos: egresos,
      neto: ingresos - egresos,
    }
  }, [entriesFiltradas])

  // Paginación
  const ITEMS_POR_PAGINA = 20
  const totalPaginas = Math.ceil(entriesFiltradas.length / ITEMS_POR_PAGINA)
  const entriesPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA
    return entriesFiltradas.slice(inicio, inicio + ITEMS_POR_PAGINA)
  }, [entriesFiltradas, paginaActual])

  // Exportar Excel Estético
  function exportarAExcel() {
    if (entriesFiltradas.length === 0) {
      toast.error('No hay registros para exportar.')
      return
    }

    let filasHtml = ''
    entriesFiltradas.forEach((e, index) => {
      const claseZebra = index % 2 === 0 ? '' : 'class="bg-zebra"'
      const claseTipo = e.entry_type === 'ingreso' ? 'class="var-up"' : 'class="var-down"'
      
      filasHtml += `
        <tr ${claseZebra}>
          <td class="text-center">${new Date(e.entry_date).toLocaleDateString('es-AR')}</td>
          <td>${e.concept}</td>
          <td ${claseTipo} class="text-center">${e.entry_type.toUpperCase()}</td>
          <td>${e.payment_method || '-'}</td>
          <td class="text-right">$${e.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        </tr>
      `
    })

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Libro Diario</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; height: 35px; border: 1px solid #cbd5e1; }
          td { border: 1px solid #e2e8f0; height: 30px; }
          .bg-zebra { background-color: #f8fafc; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .var-up { color: #16a34a; font-weight: bold; }
          .var-down { color: #dc2626; font-weight: bold; }
          .title-row { background-color: #020617; color: #ffffff; font-size: 16px; font-weight: bold; height: 40px; text-align: center; }
          .total-row { background-color: #f1f5f9; font-weight: bold; height: 35px; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th colspan="5" class="title-row">LIBRO DIARIO DE MOVIMIENTOS</th>
            </tr>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Tipo</th>
              <th>Medio de Pago</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
            <tr class="total-row">
              <td colspan="4" class="text-right">TOTAL INGRESOS:</td>
              <td class="text-right var-up">$${balanceMetrics.totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr class="total-row">
              <td colspan="4" class="text-right">TOTAL EGRESOS:</td>
              <td class="text-right var-down">$${balanceMetrics.totalEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr class="total-row">
              <td colspan="4" class="text-right">BALANCE NETO:</td>
              <td class="text-right ${balanceMetrics.neto >= 0 ? 'var-up' : 'var-down'}">$${balanceMetrics.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `libro-diario-${new Date().toISOString().split('T')[0]}.xls`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Excel exportado correctamente.')
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden space-y-6 pb-12">
      
      {/* 1. HERO HEADER */}
      <section className="relative w-full max-w-full overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-16 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              <BookOpen size={13} />
              Contabilidad de Caja
            </div>
            <h1 className="truncate text-3xl font-black tracking-tight font-sans">
              Libro Diario & Balance General
            </h1>
            <p className="mt-1 line-clamp-1 text-sm text-slate-350 font-sans">
              Seguimiento unificado de movimientos de efectivo y saldos financieros.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              onClick={exportarAExcel}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 cursor-pointer"
            >
              <FileSpreadsheet size={16} /> Exportar Reporte
            </button>
            <button
              onClick={actualizarDatos}
              disabled={cargando}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/15"
            >
              <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>
        </div>
      </section>

      {/* 2. PANEL DE BALANCE GENERAL (4 TARJETAS KPI) */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* KPI INGRESOS */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-450 uppercase tracking-wider">Ingresos del Período</span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black font-sans text-slate-900 leading-none">
              {formatCurrency(balanceMetrics.totalIngresos)}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wide">Dinero cobrado</p>
          </div>
        </div>

        {/* KPI EGRESOS */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-450 uppercase tracking-wider">Egresos del Período</span>
            <div className="rounded-xl bg-red-50 p-2 text-red-600">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black font-sans text-slate-900 leading-none">
              {formatCurrency(balanceMetrics.totalEgresos)}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wide">Compras y pagos a proveedores</p>
          </div>
        </div>

        {/* KPI BALANCE NETO */}
        <div className={`rounded-[2rem] border p-6 shadow-sm flex flex-col justify-between ${
          balanceMetrics.neto >= 0 ? 'bg-blue-50/20 border-blue-200' : 'bg-rose-50/20 border-rose-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Balance Neto</span>
            <div className={`rounded-xl p-2 ${
              balanceMetrics.neto >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
            }`}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className={`text-2xl font-black font-sans leading-none ${
              balanceMetrics.neto >= 0 ? 'text-blue-700' : 'text-red-750'
            }`}>
              {formatCurrency(balanceMetrics.neto)}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wide">Ingresos menos Egresos</p>
          </div>
        </div>

        {/* KPI DEUDA PASIVA */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-450 uppercase tracking-wider">Total Deuda Pasiva</span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black font-sans text-slate-900 leading-none">
              {formatCurrency(totalDeudaPasiva)}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wide">Deuda activa con proveedores</p>
          </div>
        </div>

      </section>

      {/* 3. FILTROS Y TABLA CRONOLÓGICA DEL LIBRO DIARIO */}
      <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        
        {/* Cabecera y Filtros */}
        <div className="border-b border-slate-200 p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Registro del Libro Diario
              </h2>
              <p className="text-xs text-slate-500">
                Listado cronológico del flujo de dinero de tu negocio.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            {/* Buscador de conceptos */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={filtroBusqueda}
                onChange={(e) => {
                  setFiltroBusqueda(e.target.value)
                  setPaginaActual(1)
                }}
                placeholder="Buscar por concepto o medio de pago..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>

            {/* Selector de Rango */}
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                <Calendar size={14} />
                <select
                  value={filtroRango}
                  onChange={(e) => {
                    setFiltroRango(e.target.value as any)
                    setPaginaActual(1)
                  }}
                  className="bg-transparent outline-none cursor-pointer text-slate-700"
                >
                  <option value="30">Últimos 30 días</option>
                  <option value="90">Últimos 90 días</option>
                  <option value="365">Último año</option>
                  <option value="todos">Histórico completo</option>
                </select>
              </div>

              {/* Selector de Tipo */}
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                <Filter size={14} />
                <select
                  value={filtroTipo}
                  onChange={(e) => {
                    setFiltroTipo(e.target.value as any)
                    setPaginaActual(1)
                  }}
                  className="bg-transparent outline-none cursor-pointer text-slate-700"
                >
                  <option value="todos">Todos los movimientos</option>
                  <option value="ingreso">Solo Ingresos</option>
                  <option value="egreso">Solo Egresos</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="w-full max-w-full overflow-x-auto">
          {entriesFiltradas.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center p-6">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <BookOpen size={24} />
              </div>
              <h3 className="text-sm font-black text-slate-900 font-sans">Sin movimientos</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-xs font-sans">
                No se encontraron registros de caja que coincidan con los filtros aplicados.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center w-28">Fecha</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">Concepto</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center w-28">Tipo</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 text-left w-36">Medio de Pago</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right w-36">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entriesPaginadas.map((entry) => {
                  const isIngreso = entry.entry_type === 'ingreso'
                  return (
                    <tr key={entry.id} className="h-12 transition hover:bg-slate-50/80 text-xs text-slate-700">
                      <td className="px-4 py-2 text-center font-semibold text-slate-500">
                        {new Date(entry.entry_date).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-2 font-bold text-slate-900">
                        {entry.concept}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black leading-none ${
                          isIngreso ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isIngreso ? (
                            <>
                              <ArrowDownLeft size={10} className="shrink-0" /> Ingreso
                            </>
                          ) : (
                            <>
                              <ArrowUpRight size={10} className="shrink-0" /> Egreso
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-semibold text-slate-650">
                        {entry.payment_method || '-'}
                      </td>
                      <td className={`px-4 py-2 text-right font-black text-sm ${
                        isIngreso ? 'text-emerald-700' : 'text-rose-750'
                      }`}>
                        {isIngreso ? '+' : '-'}{formatCurrency(entry.amount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
            <div className="flex flex-grow justify-between sm:hidden">
              <button
                onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                disabled={paginaActual === 1}
                className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas}
                className="relative ml-3 inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
            
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-slate-700 font-semibold">
                  Mostrando <span className="font-black">{(paginaActual - 1) * ITEMS_POR_PAGINA + 1}</span> a <span className="font-black">{Math.min(paginaActual * ITEMS_POR_PAGINA, entriesFiltradas.length)}</span> de <span className="font-black">{entriesFiltradas.length}</span> movimientos
                </p>
              </div>
              
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm gap-1" aria-label="Paginación">
                  <button
                    onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                    disabled={paginaActual === 1}
                    className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="relative inline-flex items-center bg-white px-4 py-2 text-xs font-black text-slate-700 rounded-xl border border-slate-300">
                    Página {paginaActual} de {totalPaginas}
                  </span>
                  <button
                    onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                    disabled={paginaActual === totalPaginas}
                    className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </section>
      
    </div>
  )
}
