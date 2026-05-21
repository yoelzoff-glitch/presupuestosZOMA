'use client'

import { useState, useMemo } from 'react'
import {
  Search,
  Calendar,
  DollarSign,
  Receipt,
  Loader2,
  CheckCircle2,
  Users,
  AlertCircle,
  Save,
  Plus,
  Trash2,
  Edit2,
  Play,
  Pause,
  Ban,
  Zap,
  TrendingUp,
  X,
  CalendarDays,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Client = {
  id: string
  name: string
  email: string | null
  phone: string | null
  cuit: string | null
}

type SubscriptionItem = {
  product_id?: string | null
  product_code?: string | null
  product_name: string
  category?: string | null
  quantity: number
  unit_price: number
}

type Subscription = {
  id: string
  company_id: string
  client_id: string
  budget_id: string | null
  name: string
  items: SubscriptionItem[]
  total_amount: number
  status: 'active' | 'paused' | 'cancelled'
  last_billed_month: string | null
  created_at: string
  clients: Client | null
}

type Props = {
  abonosIniciales: Subscription[]
  clientes: Client[]
  idEmpresa: string
  empresaNombre: string
}

export default function AbonosClient({
  abonosIniciales,
  clientes,
  idEmpresa,
  empresaNombre,
}: Props) {
  const router = useRouter()
  const [abonos, setAbonos] = useState<Subscription[]>(abonosIniciales)
  const [activeTab, setActiveTab] = useState<'pending' | 'active_abonos' | 'metrics'>('pending')
  const [busqueda, setBusqueda] = useState('')

  // Control de facturación rápida (Express Invoicing)
  const [billingAbono, setBillingAbono] = useState<Subscription | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)

  // Obtener fechas del mes actual predeterminadas
  const defaultDates = useMemo(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()

    const formatDate = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    return {
      serviceDesde: formatDate(new Date(year, month, 1)),
      serviceHasta: formatDate(new Date(year, month + 1, 0)),
      serviceVto: formatDate(new Date(year, month, 15)), // Vencimiento el 15 por defecto
    }
  }, [])

  const [billingParams, setBillingParams] = useState({
    serviceDesde: defaultDates.serviceDesde,
    serviceHasta: defaultDates.serviceHasta,
    serviceVto: defaultDates.serviceVto,
    cbteTipoOverride: 11, // Factura C por defecto, la API lo adaptará si es RI
  })

  // Control de valores personalizados rápidos en la tabla de facturación
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})

  // Control de Modal de Creación/Edición
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingAbonoId, setEditingAbonoId] = useState<string | null>(null)
  
  const [formAbono, setFormAbono] = useState({
    name: '',
    client_id: '',
    total_amount: '',
    status: 'active' as 'active' | 'paused' | 'cancelled',
    items: [] as SubscriptionItem[],
  })

  // Obtener etiqueta de mes actual en formato YYYY-MM
  const currentMonthLabel = useMemo(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  }, [])

  // Filtrar abonos según la pestaña y la búsqueda
  const abonosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return abonos.filter((abono) => {
      const coincideBusqueda =
        abono.name.toLowerCase().includes(q) ||
        abono.clients?.name.toLowerCase().includes(q) ||
        abono.clients?.cuit?.includes(q)

      if (!coincideBusqueda) return false

      if (activeTab === 'pending') {
        // Abonos activos pendientes de facturar en el mes actual
        return abono.status === 'active' && abono.last_billed_month !== currentMonthLabel
      }

      // De lo contrario, para abonos activos (todos los estados)
      return true
    })
  }, [abonos, activeTab, busqueda, currentMonthLabel])

  // KPIs de Ingresos Recurrentes (MRR)
  const kpis = useMemo(() => {
    const activos = abonos.filter((a) => a.status === 'active')
    const mrr = activos.reduce((acc, a) => acc + Number(a.total_amount), 0)

    const facturadosMes = abonos.filter(
      (a) => a.status === 'active' && a.last_billed_month === currentMonthLabel
    )
    const totalFacturadoMes = facturadosMes.reduce((acc, a) => acc + Number(a.total_amount), 0)

    const pendientesMes = activos.filter((a) => a.last_billed_month !== currentMonthLabel)
    const totalPendienteMes = pendientesMes.reduce((acc, a) => acc + Number(a.total_amount), 0)

    return {
      mrr,
      cantidadActivos: activos.length,
      totalFacturadoMes,
      totalPendienteMes,
      porcentajeBilled: mrr > 0 ? (totalFacturadoMes / mrr) * 100 : 0,
    }
  }, [abonos, currentMonthLabel])

  // Actualizar estado de abono (Activo, Pausado, Cancelado)
  async function handleUpdateStatus(id: string, newStatus: 'active' | 'paused' | 'cancelled') {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      setAbonos((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
      )
      toast.success(`Abono actualizado a: ${newStatus === 'active' ? 'Activo' : newStatus === 'paused' ? 'Pausado' : 'Cancelado'}`)
    } catch (err: any) {
      toast.error('Error al actualizar abono: ' + err.message)
    }
  }

  // Guardar abono creado o editado
  async function handleSaveAbono(e: React.FormEvent) {
    e.preventDefault()
    if (!formAbono.name.trim() || !formAbono.client_id || !formAbono.total_amount) {
      toast.error('Completá todos los campos obligatorios.')
      return
    }

    try {
      const amount = parseFloat(formAbono.total_amount)
      
      // Si no especificó ítems, creamos un ítem por defecto para la factura AFIP
      const items = formAbono.items.length > 0 
        ? formAbono.items 
        : [{
            product_name: formAbono.name,
            quantity: 1,
            unit_price: amount
          }]

      const payload = {
        company_id: idEmpresa,
        client_id: formAbono.client_id,
        name: formAbono.name.trim(),
        total_amount: amount,
        status: formAbono.status,
        items,
        updated_at: new Date().toISOString()
      }

      if (isEditing && editingAbonoId) {
        const { error } = await supabase
          .from('subscriptions')
          .update(payload)
          .eq('id', editingAbonoId)

        if (error) throw error

        toast.success('Abono modificado correctamente')
      } else {
        const { data, error } = await supabase
          .from('subscriptions')
          .insert({
            ...payload,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        toast.success('Abono registrado correctamente')
      }

      // Recargar datos desde la base de datos
      const { data: updatedList } = await supabase
        .from('subscriptions')
        .select(`
          id,
          company_id,
          client_id,
          budget_id,
          name,
          items,
          total_amount,
          status,
          last_billed_month,
          created_at,
          clients (
            id,
            name,
            email,
            phone,
            cuit
          )
        `)
        .eq('company_id', idEmpresa)
        .order('created_at', { ascending: false })

      const normalized = (updatedList || []).map(sub => ({
        ...sub,
        clients: Array.isArray(sub.clients) ? sub.clients[0] : sub.clients
      }))
      
      setAbonos(normalized as Subscription[])
      setShowCreateModal(false)
      resetForm()
    } catch (err: any) {
      toast.error('Error al guardar abono: ' + err.message)
    }
  }

  // Cargar abono para edición
  function handleEditAbono(abono: Subscription) {
    setFormAbono({
      name: abono.name,
      client_id: abono.client_id,
      total_amount: abono.total_amount.toString(),
      status: abono.status,
      items: abono.items || [],
    })
    setEditingAbonoId(abono.id)
    setIsEditing(true)
    setShowCreateModal(true)
  }

  // Eliminar un abono
  async function handleDeleteAbono(id: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar este abono de forma permanente?')) return
    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('id', id)

      if (error) throw error

      setAbonos((prev) => prev.filter((a) => a.id !== id))
      toast.success('Abono eliminado con éxito')
    } catch (err: any) {
      toast.error('Error al eliminar abono: ' + err.message)
    }
  }

  function resetForm() {
    setFormAbono({
      name: '',
      client_id: '',
      total_amount: '',
      status: 'active',
      items: [],
    })
    setEditingAbonoId(null)
    setIsEditing(false)
  }

  // Ejecutar el cobro/facturación express AFIP
  async function handleBillAbono() {
    if (!billingAbono) return
    setBillingLoading(true)
    
    try {
      const finalAmount = customAmounts[billingAbono.id] 
        ? parseFloat(customAmounts[billingAbono.id]) 
        : billingAbono.total_amount

      const response = await fetch('/api/subscriptions/bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_id: billingAbono.id,
          custom_amount: finalAmount,
          service_desde: billingParams.serviceDesde,
          service_hasta: billingParams.serviceHasta,
          service_vto: billingParams.serviceVto,
          cbteTipoOverride: billingParams.cbteTipoOverride,
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error emitiendo factura AFIP')
      }

      toast.success(`Factura Nº ${data.invoice_number} emitida con éxito. CAE: ${data.cae}`)
      
      // Actualizar localmente el abono
      setAbonos((prev) =>
        prev.map((a) =>
          a.id === billingAbono.id ? { ...a, last_billed_month: currentMonthLabel } : a
        )
      )

      // Quitar del listado y limpiar campos rápidos
      const updatedCustoms = { ...customAmounts }
      delete updatedCustoms[billingAbono.id]
      setCustomAmounts(updatedCustoms)
      
      setBillingAbono(null)
    } catch (err: any) {
      toast.error('Fallo en AFIP: ' + err.message)
    } finally {
      setBillingLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado premium del módulo */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-indigo-500/20 blur-[100px]" />
        <div className="absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-blue-500/10 blur-[80px]" />
        
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-indigo-400 ring-1 ring-indigo-400/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <Sparkles size={13} />
              Billing Recurrente (Abonos)
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Panel de Abonos Mensuales
            </h1>
            <p className="max-w-2xl font-medium text-slate-400 text-sm">
              Automatizá la facturación de servicios de tu agencia. Generá comprobantes autorizados ante la AFIP mes a mes con un solo clic.
            </p>
          </div>

          <button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="group shrink-0 inline-flex items-center gap-2.5 rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-black text-white hover:bg-indigo-500 transition active:scale-95 shadow-xl shadow-indigo-900/30"
          >
            <Plus size={18} className="transition-transform group-hover:rotate-90" />
            Crear Nuevo Abono
          </button>
        </div>
      </section>

      {/* Tarjetas de KPIs Financieros */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">MRR Mensual</p>
              <h2 className="text-2xl font-black text-slate-950">${kpis.mrr.toLocaleString('es-AR')}</h2>
              <p className="mt-0.5 text-xs font-bold text-slate-500">{kpis.cantidadActivos} contratos activos</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Facturado Este Mes</p>
              <h2 className="text-2xl font-black text-slate-950">${kpis.totalFacturadoMes.toLocaleString('es-AR')}</h2>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, kpis.porcentajeBilled)}%` }} />
                </div>
                <span className="text-[10px] font-bold text-emerald-600">{Math.round(kpis.porcentajeBilled)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pendiente de Facturar</p>
              <h2 className="text-2xl font-black text-slate-950">${kpis.totalPendienteMes.toLocaleString('es-AR')}</h2>
              <p className="mt-0.5 text-xs font-bold text-slate-500">Acciones rápidas pendientes</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Clientes Totales</p>
              <h2 className="text-2xl font-black text-slate-950">{clientes.length}</h2>
              <p className="mt-0.5 text-xs font-bold text-slate-500">En base de datos de servicios</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Interactivos y Filtros */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-2xl bg-slate-200/60 p-1 backdrop-blur-sm self-start">
          <button
            onClick={() => setActiveTab('pending')}
            className={`rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'pending'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Facturas del Mes
          </button>
          <button
            onClick={() => setActiveTab('active_abonos')}
            className={`rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'active_abonos'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Abonos Activos
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'metrics'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Métricas MRR
          </button>
        </div>

        {activeTab !== 'metrics' && (
          <div className="relative max-w-sm flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Buscar por abono o cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-xs font-bold text-slate-800 placeholder-slate-400 shadow-sm outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 animate-all duration-300"
            />
          </div>
        )}
      </div>

      {/* Vistas dinámicas según la pestaña activa */}
      {activeTab === 'pending' && (
        <div className="rounded-[2rem] border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Cliente</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Detalle del Abono</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Monto Base</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Monto del Mes ($)</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {abonosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs font-black text-slate-400">
                    ¡Felicitaciones! No hay abonos pendientes de facturación para el mes de {new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })}.
                  </td>
                </tr>
              ) : (
                abonosFiltrados.map((abono) => (
                  <tr key={abono.id}>
                    <td className="px-6 py-5">
                      <p className="font-black text-slate-900">{abono.clients?.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">CUIT: {abono.clients?.cuit || '-'}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-800">{abono.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">Items desglosados: {abono.items?.length || 1}</p>
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-600">
                      ${abono.total_amount.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-5">
                      <div className="relative max-w-[150px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">$</span>
                        <input
                          type="number"
                          placeholder={abono.total_amount.toString()}
                          value={customAmounts[abono.id] || ''}
                          onChange={(e) => {
                            setCustomAmounts({
                              ...customAmounts,
                              [abono.id]: e.target.value,
                            })
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-7 pr-3 text-xs font-black text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => {
                          setBillingAbono(abono)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-500 transition active:scale-95 shadow-lg shadow-indigo-900/10"
                      >
                        <Zap size={14} /> Facturar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'active_abonos' && (
        <div className="rounded-[2rem] border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Abono / Cliente</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Total Mensual</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Último Billed</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Estado</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {abonosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs font-black text-slate-400">
                    No se encontraron abonos registrados. Crea uno nuevo para comenzar.
                  </td>
                </tr>
              ) : (
                abonosFiltrados.map((abono) => (
                  <tr key={abono.id}>
                    <td className="px-6 py-5">
                      <p className="font-black text-slate-900">{abono.name}</p>
                      <p className="text-xs font-bold text-slate-500">{abono.clients?.name}</p>
                    </td>
                    <td className="px-6 py-5 font-black text-indigo-600">
                      ${abono.total_amount.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-500">
                      {abono.last_billed_month ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600 border border-emerald-100">
                          <CheckCircle2 size={12} /> {abono.last_billed_month}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600 border border-amber-100">
                          <AlertCircle size={12} /> Nunca facturado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                        abono.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : abono.status === 'paused'
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            : 'bg-red-500/10 text-red-600 border-red-500/20'
                      }`}>
                        {abono.status === 'active' ? 'Activo' : abono.status === 'paused' ? 'Pausado' : 'Cancelado'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right flex items-center justify-end gap-1.5 mt-1">
                      {abono.status === 'active' ? (
                        <button
                          onClick={() => handleUpdateStatus(abono.id, 'paused')}
                          className="p-2 rounded-lg bg-slate-50 text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition"
                          title="Pausar Abono"
                        >
                          <Pause size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(abono.id, 'active')}
                          className="p-2 rounded-lg bg-slate-50 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                          title="Activar Abono"
                        >
                          <Play size={14} />
                        </button>
                      )}

                      {abono.status !== 'cancelled' && (
                        <button
                          onClick={() => handleUpdateStatus(abono.id, 'cancelled')}
                          className="p-2 rounded-lg bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                          title="Cancelar Contrato"
                        >
                          <Ban size={14} />
                        </button>
                      )}

                      <button
                        onClick={() => handleEditAbono(abono)}
                        className="p-2 rounded-lg bg-slate-50 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                        title="Editar Detalle"
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        onClick={() => handleDeleteAbono(abono.id)}
                        className="p-2 rounded-lg bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                        title="Eliminar Abono"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'metrics' && (
        <section className="grid gap-6 md:grid-cols-2">
          {/* Tarjeta Métricas Resumen */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="text-indigo-600" size={20} />
              MRR y Rendimiento del Período
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                  <span>Facturación mensual total (MRR)</span>
                  <span className="font-black text-slate-900">${kpis.mrr.toLocaleString('es-AR')}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                  <span>Autorizado ante AFIP este mes</span>
                  <span className="font-black text-emerald-600">${kpis.totalFacturadoMes.toLocaleString('es-AR')}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, kpis.porcentajeBilled)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                  <span>Pendiente por facturar</span>
                  <span className="font-black text-amber-600">${kpis.totalPendienteMes.toLocaleString('es-AR')}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, 100 - kpis.porcentajeBilled)}%` }} />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-xs font-bold text-indigo-700 leading-relaxed">
              El MRR (Monthly Recurring Revenue) representa los ingresos previsibles y recurrentes que tu agencia factura mes a mes en concepto de servicios continuos.
            </div>
          </div>

          {/* Gráfico Visual de Contratos */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-slate-900">Top Contratos de Servicios</h3>
            
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {abonos.filter(a => a.status === 'active').length === 0 ? (
                <p className="text-xs font-black text-slate-400 text-center py-12">No hay contratos activos para analizar.</p>
              ) : (
                abonos
                  .filter((a) => a.status === 'active')
                  .sort((a, b) => b.total_amount - a.total_amount)
                  .slice(0, 5)
                  .map((abono) => {
                    const pct = kpis.mrr > 0 ? (abono.total_amount / kpis.mrr) * 100 : 0
                    return (
                      <div key={abono.id}>
                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                          <span className="truncate max-w-[200px]">{abono.name}</span>
                          <span className="font-black text-slate-900">${abono.total_amount.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </section>
      )}

      {/* MODAL DE CONFIRMACIÓN DE FACTURACIÓN (AFIP EXPRESS) */}
      {billingAbono && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg rounded-[2.5rem] bg-white p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Zap size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Facturación Express AFIP</h3>
                  <p className="text-xs font-bold text-slate-500">Cobro Mensual Recurrente</p>
                </div>
              </div>
              <button
                onClick={() => setBillingAbono(null)}
                className="rounded-xl p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalles del Contrato</p>
                <h4 className="font-black text-slate-900 mt-1">{billingAbono.name}</h4>
                <p className="text-xs font-bold text-slate-500 mt-0.5">Cliente: {billingAbono.clients?.name}</p>
                <p className="text-xs font-black text-indigo-600 mt-2">
                  Total a Facturar: ${
                    (customAmounts[billingAbono.id] 
                      ? parseFloat(customAmounts[billingAbono.id]) 
                      : billingAbono.total_amount
                    ).toLocaleString('es-AR')
                  }
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Período de Prestación del Servicio (AFIP)</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Servicio Desde</label>
                    <input
                      type="date"
                      value={billingParams.serviceDesde}
                      onChange={(e) => setBillingParams({ ...billingParams, serviceDesde: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Servicio Hasta</label>
                    <input
                      type="date"
                      value={billingParams.serviceHasta}
                      onChange={(e) => setBillingParams({ ...billingParams, serviceHasta: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Vencimiento del Pago</label>
                  <input
                    type="date"
                    value={billingParams.serviceVto}
                    onChange={(e) => setBillingParams({ ...billingParams, serviceVto: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Tipo Comprobante (Fuerza)</label>
                  <select
                    value={billingParams.cbteTipoOverride}
                    onChange={(e) => setBillingParams({ ...billingParams, cbteTipoOverride: parseInt(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value={11}>Factura C (Por Defecto)</option>
                    <option value={1}>Factura A (Requiere CUIT del receptor)</option>
                    <option value={6}>Factura B</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setBillingAbono(null)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-4 text-sm font-black text-slate-700 hover:bg-slate-50 active:scale-95 transition"
              >
                Cancelar
              </button>
              
              <button
                onClick={handleBillAbono}
                disabled={billingLoading}
                className="flex-1 shrink-0 rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white hover:bg-indigo-500 shadow-xl shadow-indigo-900/20 disabled:opacity-50 inline-flex items-center justify-center gap-2 active:scale-95 transition"
              >
                {billingLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Emitiendo...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Emitir Factura AFIP
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CREACIÓN / EDICIÓN DE ABONO */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg rounded-[2.5rem] bg-white p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <h3 className="text-lg font-black text-slate-900">
                {isEditing ? 'Editar Abono Recurrente' : 'Crear Nuevo Abono'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAbono} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase">Título del Abono *</label>
                <input
                  type="text"
                  placeholder="ej: Abono de Desarrollo Web e Infraestructura"
                  value={formAbono.name}
                  onChange={(e) => setFormAbono({ ...formAbono, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase">Cliente Receptor *</label>
                <select
                  value={formAbono.client_id}
                  onChange={(e) => setFormAbono({ ...formAbono, client_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  required
                  disabled={isEditing}
                >
                  <option value="">Selecciona un cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.cuit ? `(CUIT: ${c.cuit})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase">Monto Total Mensual ($) *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="120000.00"
                    value={formAbono.total_amount}
                    onChange={(e) => setFormAbono({ ...formAbono, total_amount: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-8 pr-4 text-xs font-black text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase">Estado inicial del abono</label>
                <select
                  value={formAbono.status}
                  onChange={(e) => setFormAbono({ ...formAbono, status: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                >
                  <option value="active">Activo (Comenzará a cobrarse en la próxima facturación)</option>
                  <option value="paused">Pausado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-4 text-sm font-black text-slate-700 hover:bg-slate-50 active:scale-95 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white hover:bg-indigo-500 shadow-xl shadow-indigo-900/20 active:scale-95 transition"
                >
                  {isEditing ? 'Guardar Cambios' : 'Registrar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
