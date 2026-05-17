'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { 
  Users, 
  Plus, 
  Mail, 
  Lock, 
  User, 
  Loader2, 
  ShieldCheck, 
  AlertCircle,
  Search,
  MoreVertical,
  Sparkles,
  ChevronRight,
  IdCard,
  Phone,
  MapPin,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import FilterButton from '@/app/components/FilterButton'
import { 
  Trophy, 
  TrendingUp, 
  Target, 
  BarChart3, 
  DollarSign, 
  FileText 
} from 'lucide-react'

type Props = {
  vendedoresIniciales: any[]
  estadisticasIniciales: any
  tipoPlan: string
  idEmpresa: string
}

export default function VendedoresClient({
  vendedoresIniciales,
  estadisticasIniciales,
  tipoPlan,
  idEmpresa,
}: Props) {
  const [vendedores, setVendedores] = useState<any[]>(vendedoresIniciales)
  const [cargando, setCargando] = useState(false)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [filtroDias, setFiltroDias] = useState('30')
  const [estadisticas, setEstadisticas] = useState(estadisticasIniciales)

  // Estados del formulario
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [creando, setCreando] = useState(false)

  async function actualizarVendedores() {
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('company_id', idEmpresa)
        .eq('role', 'vendedor')
        .order('full_name')

      if (error) throw error
      
      // Obtener presupuestos para calcular estadísticas
      let consultaPresupuestos = supabase
        .from('budgets')
        .select('total_amount, status, seller_id, users_profiles!budgets_seller_id_fkey(full_name)')
        .eq('company_id', idEmpresa)

      if (filtroDias !== 'all') {
        const limiteFecha = new Date()
        limiteFecha.setDate(limiteFecha.getDate() - parseInt(filtroDias))
        consultaPresupuestos = consultaPresupuestos.gte('created_at', limiteFecha.toISOString())
      }

      const { data: presupuestos } = await consultaPresupuestos
      
      if (presupuestos) {
        const estadisticasVendedores: Record<string, any> = {}
        
        presupuestos.forEach((b: any) => {
          const idVendedor = b.seller_id || 'system'
          const nombreVendedor = (b.users_profiles as any)?.full_name || 'Sistema'
          
          if (!estadisticasVendedores[idVendedor]) {
            estadisticasVendedores[idVendedor] = { nombre: nombreVendedor, ventasTotales: 0, cantidad: 0, aprobados: 0 }
          }
          
          estadisticasVendedores[idVendedor].cantidad++
          if (b.status === 'approved') {
            estadisticasVendedores[idVendedor].ventasTotales += Number(b.total_amount || 0)
            estadisticasVendedores[idVendedor].aprobados++
          }
        })

        const listaVendedores = Object.values(estadisticasVendedores)
        
        const mejorVendedor = listaVendedores.length > 0 ? listaVendedores.reduce((a: any, b: any) => (a.ventasTotales > b.ventasTotales ? a : b)) : { nombre: 'Sin datos', ventasTotales: 0 }
        const mejorProspector = listaVendedores.length > 0 ? listaVendedores.reduce((a: any, b: any) => (a.cantidad > b.cantidad ? a : b)) : { nombre: 'Sin datos', cantidad: 0 }
        const mejorConversion = listaVendedores.length > 0 
          ? (listaVendedores as any[])
            .map(s => ({ ...s, tasa: s.cantidad > 0 ? (s.aprobados / s.cantidad) * 100 : 0 }))
            .reduce((a, b) => (a.tasa > b.tasa ? a : b))
          : { nombre: 'Sin datos', tasa: 0 }

        setEstadisticas({
          topSeller: { name: mejorVendedor.nombre, value: (mejorVendedor as any).ventasTotales },
          topProspector: { name: mejorProspector.nombre, value: (mejorProspector as any).cantidad },
          bestConversion: { name: (mejorConversion as any).nombre, value: (mejorConversion as any).tasa },
          totalBudgets: presupuestos.length,
          totalSales: presupuestos.filter(b => b.status === 'approved').reduce((acc, b) => acc + Number(b.total_amount), 0)
        })
      }

      setVendedores(data || [])
    } catch (error: any) {
      toast.error('Error cargando vendedores: ' + error.message)
    } finally {
      setCargando(false)
    }
  }

  async function manejarCrearVendedor(e: React.FormEvent) {
    e.preventDefault()
    if (!nombreCompleto || !correo || !contrasena) {
      toast.error('Completá todos los campos')
      return
    }

    setCreando(true)
    try {
      const respuesta = await fetch('/api/vendedores/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          full_name: nombreCompleto, 
          email: correo, 
          password: contrasena,
          phone: telefono,
          address: direccion
        })
      })

      const datos = await respuesta.json()
      if (!respuesta.ok) throw new Error(datos.detail || datos.error || 'Error desconocido')

      toast.success('Vendedor creado correctamente')
      setMostrarModal(false)
      setNombreCompleto('')
      setCorreo('')
      setContrasena('')
      setTelefono('')
      setDireccion('')
      actualizarVendedores()
    } catch (error: any) {
      toast.error(error.message || 'Error al crear vendedor')
    } finally {
      setCreando(false)
    }
  }

  const vendedoresFiltrados = vendedores.filter(v => 
    v.full_name?.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
    v.email?.toLowerCase().includes(terminoBusqueda.toLowerCase())
  )
  if (tipoPlan === 'base') {
    const messageText = `Hola! Quiero actualizar mi cuenta del Plan BASE al Plan PRO ($110.000/mes) para activar el módulo de Gestión de Vendedores en ZOMA.`
    const encodedText = encodeURIComponent(messageText)

    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-full animate-pulse" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-slate-950 text-blue-500 shadow-2xl">
            <Users size={48} strokeWidth={2.5} />
          </div>
        </div>
        
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-600 text-xs font-black uppercase tracking-widest ring-1 ring-blue-500/20 animate-bounce">
            <Sparkles size={14} /> Función Exclusiva PRO
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border border-slate-200 shadow-sm">
            Tu plan actual: BASE
          </span>
        </div>
        
        <h2 className="text-4xl font-black tracking-tight text-slate-900 mb-4 max-w-lg">
          Llevá tu fuerza de ventas al <span className="text-blue-600 underline decoration-blue-600/20 underline-offset-8">siguiente nivel.</span>
        </h2>
        
        <p className="max-w-md text-lg font-bold text-slate-500 leading-relaxed mb-6">
          El módulo de Gestión de Vendedores te permite delegar la carga de presupuestos y pedidos manteniendo el control total del negocio.
        </p>

        <div className="rounded-3xl bg-blue-50/70 border border-blue-100 p-5 max-w-xs mx-auto shadow-sm mb-10 w-full">
          <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Inversión Plan PRO</p>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-3xl font-black text-slate-900">$110.000</span>
            <span className="text-xs font-bold text-slate-400">/ mes</span>
          </div>
        </div>
        
        <div className="grid gap-6 sm:grid-cols-2 max-w-2xl mb-12 text-left">
          <div className="flex gap-4 p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Users size={20}/></div>
            <div>
              <p className="font-black text-slate-900 text-sm">Equipos de Venta</p>
              <p className="text-xs font-bold text-slate-500 mt-1">Cuentas ilimitadas para tus vendedores con acceso restringido.</p>
            </div>
          </div>
          <div className="flex gap-4 p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><Mail size={20}/></div>
            <div>
              <p className="font-black text-slate-900 text-sm">Chat Interno</p>
              <p className="text-xs font-bold text-slate-500 mt-1">Comunicación fluida entre administración y vendedores en tiempo real.</p>
            </div>
          </div>
        </div>
 
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={`https://wa.me/5491100000000?text=${encodedText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-8 py-4.5 text-sm font-black text-white shadow-2xl transition-all hover:bg-slate-900 active:scale-95 animate-in fade-in"
          >
            Mejorar mi Plan a PRO
            <ChevronRight size={18} />
          </a>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-4.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Volver al Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">
            Equipo de Ventas
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Administrá a tus vendedores y visualizá su rendimiento en tiempo real.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl mr-2">
            <FilterButton active={filtroDias === '7'} onClick={() => setFiltroDias('7')}>7D</FilterButton>
            <FilterButton active={filtroDias === '30'} onClick={() => setFiltroDias('30')}>30D</FilterButton>
            <FilterButton active={filtroDias === '90'} onClick={() => setFiltroDias('90')}>90D</FilterButton>
            <FilterButton active={filtroDias === 'all'} onClick={() => setFiltroDias('all')}>Todo</FilterButton>
          </div>
          <button
            onClick={() => setMostrarModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95"
          >
            <Plus size={18} strokeWidth={3} />
            Nuevo Vendedor
          </button>
        </div>
      </div>

      {/* Tarjetas de Estadísticas - Leaderboard */}
      <div className="grid gap-5 md:grid-cols-3">
        <div className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-amber-500/5 transition-transform group-hover:scale-150" />
          <div className="relative z-10 flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-inner">
              <Trophy size={28} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Top Ventas ($)</p>
              <h4 className="mt-0.5 truncate text-lg font-black text-slate-900">{estadisticas.topSeller.name}</h4>
              <p className="text-sm font-black text-amber-600">${estadisticas.topSeller.value.toLocaleString('es-AR')}</p>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-blue-500/5 transition-transform group-hover:scale-150" />
          <div className="relative z-10 flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner">
              <TrendingUp size={28} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Top Presupuestos</p>
              <h4 className="mt-0.5 truncate text-lg font-black text-slate-900">{estadisticas.topProspector.name}</h4>
              <p className="text-sm font-black text-blue-600">{estadisticas.topProspector.value} emitidos</p>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-emerald-500/5 transition-transform group-hover:scale-150" />
          <div className="relative z-10 flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner">
              <Target size={28} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mejor Conversión</p>
              <h4 className="mt-0.5 truncate text-lg font-black text-slate-900">{estadisticas.bestConversion.name}</h4>
              <p className="text-sm font-black text-emerald-600">{estadisticas.bestConversion.value.toFixed(1)}% de cierre</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas de Estadísticas - Global */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm"><Users size={16} /></div>
              <p className="text-xs font-bold text-slate-500">Equipo Total</p>
            </div>
            <p className="text-lg font-black text-slate-900">{vendedores.length}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm"><FileText size={16} /></div>
              <p className="text-xs font-bold text-slate-500">Presupuestos (Periodo)</p>
            </div>
            <p className="text-lg font-black text-slate-900">{estadisticas.totalBudgets}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm"><DollarSign size={16} /></div>
              <p className="text-xs font-bold text-slate-500">Volumen Cerrado</p>
            </div>
            <p className="text-lg font-black text-slate-900">${estadisticas.totalSales.toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>

      {/* Cuadrícula de Tarjetas */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cargando ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[320px] animate-pulse rounded-[2rem] bg-slate-100" />
          ))
        ) : vendedoresFiltrados.length === 0 ? (
          <div className="col-span-full py-20 text-center">
            <Users size={48} className="mx-auto mb-4 text-slate-200" />
            <p className="font-black text-slate-400 text-lg">No se encontraron vendedores.</p>
          </div>
        ) : (
          vendedoresFiltrados.map((v) => (
            <article key={v.id} className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] bg-slate-950 text-white font-black text-xl shadow-lg shadow-slate-950/20 group-hover:scale-110 transition-transform">
                  {v.full_name?.charAt(0).toUpperCase() || 'V'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="truncate text-lg font-black text-slate-900 tracking-tight">{v.full_name}</h3>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <IdCard size={12} className="text-blue-500" /> {v.dni || v.id.slice(0, 8)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                    <Mail size={14} />
                  </div>
                  <span className="text-sm font-bold truncate">{v.email || 'vendedor@sistema.com'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                    <Phone size={14} />
                  </div>
                  <span className="text-sm font-bold">{v.phone || 'Sin teléfono'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                    <MapPin size={14} />
                  </div>
                  <span className="text-sm font-bold truncate">{v.address || 'Sin dirección'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                <div className="bg-slate-50 px-3 py-1.5 rounded-lg">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Alta</p>
                  <p className="text-[10px] font-black text-slate-600">{new Date(v.created_at || Date.now()).toLocaleDateString()}</p>
                </div>
                
                <Link 
                  href={`/vendedores/${v.id}`}
                  className="inline-flex items-center gap-2 text-sm font-black text-blue-600 hover:gap-3 transition-all"
                >
                  Ver Ficha
                  <ChevronRight size={18} strokeWidth={3} />
                </Link>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Modal Nuevo Vendedor */}
      {mostrarModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !creando && setMostrarModal(false)} />
          <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-2xl">
            <div className="mb-8">
              <h3 className="text-2xl font-black text-slate-950">Nuevo Vendedor</h3>
              <p className="text-sm font-bold text-slate-500">Completá los datos para crear la cuenta.</p>
            </div>

            <form onSubmit={manejarCrearVendedor} className="space-y-5">
              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-500">Nombre Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    placeholder="ej: Juan Pérez"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-500">Email (Usuario)</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    required
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="vendedor@empresa.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-500">Contraseña Inicial</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-500">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej: +54 9 11 ..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-500">Dirección</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Calle, Ciudad, Provincia"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={creando}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {creando ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} strokeWidth={3} />}
                  Crear Cuenta de Vendedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
