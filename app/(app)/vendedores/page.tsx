'use client'

import { useState, useEffect } from 'react'
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

export default function VendedoresPage() {
  const [vendedores, setVendedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [planType, setPlanType] = useState<string | null>(null)
  const [daysFilter, setDaysFilter] = useState('30')
  const [stats, setStats] = useState({
    topSeller: { name: 'Sin datos', value: 0 },
    topProspector: { name: 'Sin datos', value: 0 },
    bestConversion: { name: 'Sin datos', value: 0 },
    totalBudgets: 0,
    totalSales: 0
  })

  // Form states
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchVendedores()
  }, [daysFilter])

  async function fetchVendedores() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users_profiles')
        .select('company_id, company:companies(plan_type)')
        .eq('id', user.id)
        .single()

      if (!profile) return

      const plan = (profile.company as any)?.plan_type || 'base'
      setPlanType(plan)

      if (plan === 'base') {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('role', 'vendedor')
        .order('full_name')

      if (error) throw error
      
      // Fetch budgets to calculate stats
      let budgetsQuery = supabase
        .from('budgets')
        .select('total_amount, status, seller_id, users_profiles!budgets_seller_id_fkey(full_name)')
        .eq('company_id', profile.company_id)

      if (daysFilter !== 'all') {
        const dateLimit = new Date()
        dateLimit.setDate(dateLimit.getDate() - parseInt(daysFilter))
        budgetsQuery = budgetsQuery.gte('created_at', dateLimit.toISOString())
      }

      const { data: budgets } = await budgetsQuery
      
      if (budgets) {
        const sellerStats: Record<string, any> = {}
        
        budgets.forEach((b: any) => {
          const sellerId = b.seller_id || 'system'
          const sellerName = (b.users_profiles as any)?.full_name || 'Sistema'
          
          if (!sellerStats[sellerId]) {
            sellerStats[sellerId] = { name: sellerName, totalSales: 0, count: 0, approved: 0 }
          }
          
          sellerStats[sellerId].count++
          if (b.status === 'approved') {
            sellerStats[sellerId].totalSales += Number(b.total_amount || 0)
            sellerStats[sellerId].approved++
          }
        })

        const sellersList = Object.values(sellerStats)
        
        const topSeller = sellersList.length > 0 ? sellersList.reduce((a, b) => (a.totalSales > b.totalSales ? a : b)) : { name: 'Sin datos', totalSales: 0 }
        const topProspector = sellersList.length > 0 ? sellersList.reduce((a, b) => (a.count > b.count ? a : b)) : { name: 'Sin datos', count: 0 }
        const bestConversion = sellersList.length > 0 
          ? sellersList
            .map(s => ({ ...s, rate: s.count > 0 ? (s.approved / s.count) * 100 : 0 }))
            .reduce((a, b) => (a.rate > b.rate ? a : b))
          : { name: 'Sin datos', rate: 0 }

        setStats({
          topSeller: { name: topSeller.name, value: topSeller.totalSales },
          topProspector: { name: topProspector.name, value: topProspector.count },
          bestConversion: { name: bestConversion.name, value: bestConversion.rate },
          totalBudgets: budgets.length,
          totalSales: budgets.filter(b => b.status === 'approved').reduce((acc, b) => acc + Number(b.total_amount), 0)
        })
      }

      setVendedores(data || [])
    } catch (error: any) {
      toast.error('Error cargando vendedores: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateVendedor(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName || !email || !password) {
      toast.error('Completá todos los campos')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/vendedores/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, password })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || data.error || 'Error desconocido')

      toast.success('Vendedor creado correctamente')
      setShowModal(false)
      setFullName('')
      setEmail('')
      setPassword('')
      fetchVendedores()
    } catch (error: any) {
      toast.error(error.message || 'Error al crear vendedor')
    } finally {
      setCreating(false)
    }
  }

  const filteredVendedores = vendedores.filter(v => 
    v.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )


  if (!planType) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (planType === 'base') {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-full" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-slate-950 text-blue-500 shadow-2xl">
            <Users size={48} strokeWidth={2.5} />
          </div>
        </div>
        
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-blue-600 ring-1 ring-blue-500/20 mb-6">
          <Sparkles size={14} /> Función Exclusiva PRO
        </div>
        
        <h2 className="text-4xl font-black tracking-tight text-slate-900 mb-4 max-w-lg">
          Llevá tu fuerza de ventas al <span className="text-blue-600 underline decoration-blue-600/20 underline-offset-8">siguiente nivel.</span>
        </h2>
        
        <p className="max-w-md text-lg font-bold text-slate-500 leading-relaxed mb-10">
          El módulo de Gestión de Vendedores te permite delegar la carga de presupuestos y pedidos manteniendo el control total del negocio.
        </p>
        
        <div className="grid gap-6 sm:grid-cols-2 max-w-2xl mb-12 text-left">
          <div className="flex gap-4 p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Users size={20}/></div>
            <div>
              <p className="font-black text-slate-900 text-sm">Equipos de Venta</p>
              <p className="text-xs font-bold text-slate-500 mt-1">Cuentas ilimitadas para tus vendedores con acceso restringido.</p>
            </div>
          </div>
          <div className="flex gap-4 p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><Mail size={20}/></div>
            <div>
              <p className="font-black text-slate-900 text-sm">Chat Interno</p>
              <p className="text-xs font-bold text-slate-500 mt-1">Comunicación fluida entre administración y vendedores en tiempo real.</p>
            </div>
          </div>
        </div>

        <a
          href="https://wa.me/5491100000000?text=Hola,%20quiero%20mejorar%20mi%20plan%20al%20PRO%20para%20activar%20vendedores"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-10 py-5 text-sm font-black text-white shadow-2xl transition-all hover:bg-slate-900 active:scale-95"
        >
          Mejorar mi Plan a PRO
          <ChevronRight size={18} />
        </a>
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
            <FilterButton active={daysFilter === '7'} onClick={() => setDaysFilter('7')}>7D</FilterButton>
            <FilterButton active={daysFilter === '30'} onClick={() => setDaysFilter('30')}>30D</FilterButton>
            <FilterButton active={daysFilter === '90'} onClick={() => setDaysFilter('90')}>90D</FilterButton>
            <FilterButton active={daysFilter === 'all'} onClick={() => setDaysFilter('all')}>Todo</FilterButton>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95"
          >
            <Plus size={18} strokeWidth={3} />
            Nuevo Vendedor
          </button>
        </div>
      </div>

      {/* Stats Cards - Leaderboard */}
      <div className="grid gap-5 md:grid-cols-3">
        <div className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-amber-500/5 transition-transform group-hover:scale-150" />
          <div className="relative z-10 flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-inner">
              <Trophy size={28} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Top Ventas ($)</p>
              <h4 className="mt-0.5 truncate text-lg font-black text-slate-900">{stats.topSeller.name}</h4>
              <p className="text-sm font-black text-amber-600">${stats.topSeller.value.toLocaleString('es-AR')}</p>
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
              <h4 className="mt-0.5 truncate text-lg font-black text-slate-900">{stats.topProspector.name}</h4>
              <p className="text-sm font-black text-blue-600">{stats.topProspector.value} emitidos</p>
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
              <h4 className="mt-0.5 truncate text-lg font-black text-slate-900">{stats.bestConversion.name}</h4>
              <p className="text-sm font-black text-emerald-600">{stats.bestConversion.value.toFixed(1)}% de cierre</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Global */}
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
            <p className="text-lg font-black text-slate-900">{stats.totalBudgets}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm"><DollarSign size={16} /></div>
              <p className="text-xs font-bold text-slate-500">Volumen Cerrado</p>
            </div>
            <p className="text-lg font-black text-slate-900">${stats.totalSales.toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>

      {/* Grid de Tarjetas */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[320px] animate-pulse rounded-[2rem] bg-slate-100" />
          ))
        ) : filteredVendedores.length === 0 ? (
          <div className="col-span-full py-20 text-center">
            <Users size={48} className="mx-auto mb-4 text-slate-200" />
            <p className="font-black text-slate-400 text-lg">No se encontraron vendedores.</p>
          </div>
        ) : (
          filteredVendedores.map((v) => (
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

      {/* Modal Nueva Vendedor */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !creating && setShowModal(false)} />
          <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-2xl">
            <div className="mb-8">
              <h3 className="text-2xl font-black text-slate-950">Nuevo Vendedor</h3>
              <p className="text-sm font-bold text-slate-500">Completá los datos para crear la cuenta.</p>
            </div>

            <form onSubmit={handleCreateVendedor} className="space-y-5">
              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-500">Nombre Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} strokeWidth={3} />}
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
