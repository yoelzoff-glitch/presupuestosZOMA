'use client'

import { useState, useMemo } from 'react'
import { 
  FileText, 
  Download, 
  Search, 
  Building2, 
  Calendar, 
  DollarSign, 
  Receipt, 
  Percent, 
  Loader2, 
  CheckCircle2, 
  UserPlus,
  Users,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'

type Client = {
  name: string
  cuit: string
}

type Invoice = {
  id: string
  invoice_date: string
  afip_comprobante_tipo: number
  afip_comprobante_numero: number
  invoice_number: string
  total_amount: number
  status: 'emitted' | 'cancelled' | 'draft'
  client: Client | null
}

type ConfigFiscal = {
  afip_cuit: string
  afip_razon_social: string
  is_sandbox: boolean
} | null

type DBClient = {
  id: string
  name: string
  cuit: string | null
}

type Movement = {
  client_id: string
  debit: number
  credit: number
}

type Props = {
  invoicesIniciales: Invoice[]
  idEmpresa: string
  nombreEmpresa: string
  configFiscal: ConfigFiscal
  clients: DBClient[]
  movements: Movement[]
  userRole: string
}

export default function ContadorClient({ 
  invoicesIniciales, 
  idEmpresa, 
  nombreEmpresa, 
  configFiscal,
  clients,
  movements,
  userRole
}: Props) {
  const [activeTab, setActiveTab] = useState<'iva' | 'cc' | 'config'>('iva')
  const [invoices] = useState<Invoice[]>(invoicesIniciales)
  
  // Estados para Búsqueda
  const [busquedaIva, setBusquedaIva] = useState('')
  const [busquedaCc, setBusquedaCc] = useState('')

  // Generador de meses históricos (los últimos 12 meses)
  const mesesHistoricos = useMemo(() => {
    const lista = []
    const hoy = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      lista.push({ value: `${year}-${month}`, label: label.charAt(0).toUpperCase() + label.slice(1) })
    }
    return lista
  }, [])

  const [mesSeleccionado, setMesSeleccionado] = useState(mesesHistoricos[0].value)

  // Filtrar facturas por mes seleccionado e input de búsqueda
  const facturasFiltradas = useMemo(() => {
    const [selYear, selMonth] = mesSeleccionado.split('-')
    
    return invoices.filter(f => {
      const [fYear, fMonth] = f.invoice_date.split('-')
      const coincideMes = fYear === selYear && fMonth === selMonth

      const q = busquedaIva.toLowerCase().trim()
      const coincideBusqueda = !q || 
        f.client?.name?.toLowerCase().includes(q) || 
        f.client?.cuit?.replace(/-/g, '').includes(q) ||
        String(f.afip_comprobante_numero).includes(q)

      return coincideMes && coincideBusqueda
    })
  }, [invoices, mesSeleccionado, busquedaIva])

  // KPIs Financieros de Facturación
  const kpis = useMemo(() => {
    let totalFacturado = 0
    let totalIva = 0
    let totalNeto = 0
    let cantFacturas = 0
    let cantNotasCredito = 0

    facturasFiltradas.forEach(f => {
      const isNC = [3, 8, 13].includes(f.afip_comprobante_tipo) || f.status === 'cancelled'
      const total = Number(f.total_amount)
      
      const esInscripto = [1, 6, 3, 8, 2, 7].includes(f.afip_comprobante_tipo)
      const neto = esInscripto ? total / 1.21 : total
      const iva = esInscripto ? total - neto : 0

      if (isNC) {
        totalFacturado -= total
        totalIva -= iva
        totalNeto -= neto
        cantNotasCredito++
      } else {
        totalFacturado += total
        totalIva += iva
        totalNeto += neto
        cantFacturas++
      }
    })

    return {
      totalFacturado,
      totalIva,
      totalNeto,
      cantFacturas,
      cantNotasCredito
    }
  }, [facturasFiltradas])

  // Calcular saldos de Cuenta Corriente por Cliente
  const saldosClientes = useMemo(() => {
    return clients.map(c => {
      const ms = movements.filter(m => m.client_id === c.id)
      const debito = ms.reduce((sum, m) => sum + Number(m.debit || 0), 0)
      const credito = ms.reduce((sum, m) => sum + Number(m.credit || 0), 0)
      const saldo = debito - credito
      
      return {
        ...c,
        debito,
        credito,
        saldo
      }
    }).filter(c => {
      const q = busquedaCc.toLowerCase().trim()
      return !q || 
        c.name.toLowerCase().includes(q) || 
        c.cuit?.replace(/-/g, '').includes(q)
    })
  }, [clients, movements, busquedaCc])

  // Descargar el Libro de IVA Digital
  const [exportando, setExportando] = useState(false)

  async function exportarIvaDigital() {
    setExportando(true)
    try {
      const [year, month] = mesSeleccionado.split('-')
      const ultimoDia = new Date(Number(year), Number(month), 0).getDate()
      const fechaDesde = `${year}-${month}-01`
      const fechaHasta = `${year}-${month}-${String(ultimoDia).padStart(2, '0')}`

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

      toast.success('¡Libro de IVA Digital descargado con éxito!')
    } catch (err: any) {
      toast.error('Error al exportar: ' + err.message)
    } finally {
      setExportando(false)
    }
  }

  // Creación de Usuario de Estudio Contable (Solo para Admins)
  const [emailContador, setEmailContador] = useState('')
  const [nombreContador, setNombreContador] = useState('')
  const [passContador, setPassContador] = useState('')
  const [creandoContador, setCreandoContador] = useState(false)
  const [contadorCreado, setContadorCreado] = useState(false)

  async function registrarContador(e: React.FormEvent) {
    e.preventDefault()
    if (!emailContador || !nombreContador || !passContador) {
      toast.error('Por favor completa todos los campos.')
      return
    }

    setCreandoContador(true)
    try {
      const response = await fetch('/api/contador/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailContador,
          password: passContador,
          full_name: nombreContador
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Error al vincular el estudio contable')
      }

      setContadorCreado(true)
      toast.success('¡Estudio Contable vinculado con éxito!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCreandoContador(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* TABS DE NAVEGACIÓN PRINCIPAL */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-sm max-w-lg">
        <button
          onClick={() => setActiveTab('iva')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition ${
            activeTab === 'iva'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <FileText size={16} />
          <span>Libro IVA Digital</span>
        </button>

        <button
          onClick={() => setActiveTab('cc')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition ${
            activeTab === 'cc'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Users size={16} />
          <span>Cuentas Corrientes</span>
        </button>

        {userRole === 'admin' && (
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition ${
              activeTab === 'config'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Settings size={16} />
            <span>Configuración</span>
          </button>
        )}
      </div>

      {/* CONTENIDO TAB 1: LIBRO DE IVA DIGITAL */}
      {activeTab === 'iva' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Datos Fiscales */}
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-950 uppercase tracking-tight">Datos Fiscales</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identidad Comercial</p>
                  </div>
                </div>
                <div className="space-y-3 mt-5">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase">Razón Social:</span>
                    <p className="text-sm font-extrabold text-slate-800">{configFiscal?.afip_razon_social || nombreEmpresa}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase">CUIT:</span>
                    <p className="text-sm font-extrabold text-slate-800">
                      {configFiscal?.afip_cuit ? configFiscal.afip_cuit.replace(/(\d{2})(\d{8})(\d{1})/, '$1-$2-$3') : 'No configurado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase">Entorno AFIP:</span>
                    <p className="text-xs font-bold mt-1">
                      <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[9px] ${configFiscal?.is_sandbox ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {configFiscal?.is_sandbox ? 'Homologación (Pruebas)' : 'Producción (Real)'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Selector e IVA */}
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between lg:col-span-2">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-950 uppercase tracking-tight">Período de Liquidación</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Libro de IVA Digital (AFIP)</p>
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-500 leading-relaxed mt-4">
                  Seleccioná el mes de liquidación. El sistema generará los dos archivos planos (<code className="font-mono text-indigo-600 font-bold">Ventas.txt</code> y <code className="font-mono text-indigo-600 font-bold">Alicuotas.txt</code>) listos para importar directamente en AFIP sin re-tipear datos.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-6">
                <select
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800 outline-none focus:border-indigo-500 shadow-sm flex-1"
                >
                  {mesesHistoricos.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>

                <button
                  onClick={exportarIvaDigital}
                  disabled={exportando}
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 transition text-white px-6 py-3.5 text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/10 disabled:opacity-50 min-w-[200px]"
                >
                  {exportando ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-white/80" />
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>Descargar IVA Digital</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* KPIs Financieros */}
          <section className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">Neto Gravado</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><DollarSign size={14} /></div>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">${kpis.totalNeto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">IVA Débito (21%)</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Percent size={14} /></div>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">${kpis.totalIva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">Total Facturado</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Receipt size={14} /></div>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">${kpis.totalFacturado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">Ventas / NC emitidas</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600"><FileText size={14} /></div>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{kpis.cantFacturas} / {kpis.cantNotasCredito}</p>
            </div>
          </section>

          {/* Listado de comprobantes */}
          <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 p-5 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Comprobantes Emitidos</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalle del período seleccionado</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={busquedaIva}
                  onChange={(e) => setBusquedaIva(e.target.value)}
                  placeholder="Buscar por cliente o factura..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Nro. Factura</th>
                    <th className="px-6 py-4">Cliente / CUIT</th>
                    <th className="px-6 py-4 text-right">Neto Gravado</th>
                    <th className="px-6 py-4 text-right">IVA (21%)</th>
                    <th className="px-6 py-4 text-right">Monto Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {facturasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-400 font-bold italic text-xs">
                        No hay comprobantes cargados en el mes seleccionado.
                      </td>
                    </tr>
                  ) : facturasFiltradas.map(f => {
                    const isNC = [3, 8, 13].includes(f.afip_comprobante_tipo) || f.status === 'cancelled'
                    const esInscripto = [1, 6, 3, 8, 2, 7].includes(f.afip_comprobante_tipo)
                    const neto = esInscripto ? f.total_amount / 1.21 : f.total_amount
                    const iva = esInscripto ? f.total_amount - neto : 0

                    return (
                      <tr key={f.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4 text-xs font-extrabold text-slate-900">
                          {String(f.afip_comprobante_numero || 0).padStart(8, '0')}
                          {isNC && <span className="ml-2 px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-black text-[8px] uppercase tracking-wider border border-red-100">N. Crédito</span>}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-800">{f.client?.name || 'CONSUMIDOR FINAL'}</p>
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                            {f.client?.cuit ? f.client.cuit.replace(/(\d{2})(\d{8})(\d{1})/, '$1-$2-$3') : 'S/D'}
                          </p>
                        </td>
                        <td className={`px-6 py-4 text-right text-xs font-bold ${isNC ? 'text-red-500' : 'text-slate-600'}`}>
                          {isNC ? '-' : ''}${neto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-6 py-4 text-right text-xs font-bold ${isNC ? 'text-red-500' : 'text-slate-600'}`}>
                          {isNC ? '-' : ''}${iva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-6 py-4 text-right text-xs font-black ${isNC ? 'text-red-600' : 'text-slate-900'}`}>
                          {isNC ? '-' : ''}${f.total_amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 2: CUENTAS CORRIENTES (SALDOS) */}
      {activeTab === 'cc' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 p-5 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Saldos de Cuentas Corrientes</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cuentas por Cobrar (Activas)</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={busquedaCc}
                  onChange={(e) => setBusquedaCc(e.target.value)}
                  placeholder="Buscar por cliente o CUIT..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">CUIT</th>
                    <th className="px-6 py-4 text-right">Total Débito (Ventas)</th>
                    <th className="px-6 py-4 text-right">Total Crédito (Pagos)</th>
                    <th className="px-6 py-4 text-right">Saldo Deudor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {saldosClientes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-400 font-bold italic text-xs">
                        No se encontraron clientes o cuentas deudoras activas.
                      </td>
                    </tr>
                  ) : saldosClientes.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 text-xs font-extrabold text-slate-900">
                        {c.name}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                        {c.cuit ? c.cuit.replace(/(\d{2})(\d{8})(\d{1})/, '$1-$2-$3') : 'Consumidor Final'}
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-bold text-slate-600">
                        ${c.debito.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-bold text-slate-600">
                        ${c.credito.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-6 py-4 text-right text-xs font-black ${c.saldo > 0 ? 'text-amber-600' : c.saldo < 0 ? 'text-emerald-600' : 'text-slate-950'}`}>
                        ${c.saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 3: CONFIGURACIÓN / INVITACIÓN AL CONTADOR (SOLO ADMINS) */}
      {activeTab === 'config' && userRole === 'admin' && (
        <div className="max-w-2xl rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-950 uppercase tracking-tight">Vincular Estudio Contable</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acceso Directo Exclusivo</p>
            </div>
          </div>

          {contadorCreado ? (
            <div className="text-center py-8 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">¡Estudio Vinculado con éxito!</h4>
              <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-sm mx-auto">
                Tu contador ya puede acceder a la aplicación ingresando directamente a <code className="font-mono text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">zoma.app/auth/login</code> con su dirección de email.
              </p>
            </div>
          ) : (
            <form onSubmit={registrarContador} className="space-y-4">
              <p className="text-xs font-medium text-slate-500 leading-relaxed mb-4">
                Crea un usuario exclusivo para tu estudio contable. Tu contador podrá iniciar sesión y ver únicamente esta interfaz fiscal de consultas y exportaciones, bloqueando por completo la vista de tus recetas de producción y operaciones de venta directa preventistas.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Nombre Completo / Estudio</label>
                  <input
                    type="text"
                    required
                    value={nombreContador}
                    onChange={(e) => setNombreContador(e.target.value)}
                    placeholder="Estudio Contable Pérez & Asoc."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Email del Contador</label>
                  <input
                    type="email"
                    required
                    value={emailContador}
                    onChange={(e) => setEmailContador(e.target.value)}
                    placeholder="contador@estudio.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Contraseña de Acceso</label>
                <input
                  type="password"
                  required
                  value={passContador}
                  onChange={(e) => setPassContador(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 shadow-sm max-w-sm"
                />
              </div>

              <button
                type="submit"
                disabled={creandoContador}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-98 transition text-white px-6 py-3.5 text-xs font-black uppercase tracking-wider shadow-lg shadow-purple-600/10 disabled:opacity-50 mt-2"
              >
                {creandoContador ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-white/80" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={15} />
                    <span>Registrar Estudio Contable</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
