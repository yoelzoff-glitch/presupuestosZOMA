'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  ArrowLeft,
  Users,
  FileText,
  ClipboardList,
  TrendingUp,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Loader2,
  ChevronRight,
  User,
  Target,
  CheckCircle2,
  Clock3,
  Percent,
} from 'lucide-react'
import { toast } from 'sonner'

export default function VendedorDetallePage() {
  const params = useParams()
  const router = useRouter()
  const sellerId = params.id as string

  const [seller, setSeller] = useState<any>(null)
  const [stats, setStats] = useState({
    totalBudgets: 0,
    totalOrders: 0,
    totalBudgetedAmount: 0,
    totalConfirmedAmount: 0,
    clientCount: 0
  })
  const [recentBudgets, setRecentBudgets] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [daysFilter, setDaysFilter] = useState('30')
  const [loading, setLoading] = useState(true)
  const [commissionPercentage, setCommissionPercentage] = useState(0)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (sellerId) loadSellerData()
  }, [sellerId, daysFilter])

  async function loadSellerData() {
    setLoading(true)
    try {
      // 1. Perfil del vendedor
      const { data: profile, error: pError } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('id', sellerId)
        .single()

      if (pError) throw pError
      setSeller(profile)
      setCommissionPercentage(profile.commission_percentage || 0)

      // 2. Stats de Presupuestos (con filtro de fecha)
      let budgetsQuery = supabase
        .from('budgets')
        .select('id, total_amount, status, created_at, clients(name)')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })

      if (daysFilter !== 'all') {
        const dateLimit = new Date()
        dateLimit.setDate(dateLimit.getDate() - parseInt(daysFilter))
        budgetsQuery = budgetsQuery.gte('created_at', dateLimit.toISOString())
      }

      const { data: budgets, error: bError } = await budgetsQuery

      if (bError) throw bError

      // 3. Stats de Pedidos
      let ordersQuery = supabase
        .from('orders')
        .select('id, total_amount, status')
        .eq('seller_id', sellerId)

      if (daysFilter !== 'all') {
        const dateLimit = new Date()
        dateLimit.setDate(dateLimit.getDate() - parseInt(daysFilter))
        ordersQuery = ordersQuery.gte('created_at', dateLimit.toISOString())
      }

      const { data: orders, error: oError } = await ordersQuery

      // 4. Clientes asignados
      const { data: sellerClients, error: cError } = await supabase
        .from('clients')
        .select('id, name, cuit, email')
        .eq('seller_id', sellerId)

      const totalBudgeted = budgets.reduce((acc, b) => acc + Number(b.total_amount || 0), 0)
      const confirmedBudgets = budgets.filter(b => b.status === 'approved' || b.status === 'confirmed')
      const totalConfirmed = confirmedBudgets.reduce((acc, b) => acc + Number(b.total_amount || 0), 0)

      setStats({
        totalBudgets: budgets.length,
        totalOrders: confirmedBudgets.length,
        totalBudgetedAmount: totalBudgeted,
        totalConfirmedAmount: totalConfirmed,
        clientCount: sellerClients?.length || 0
      })

      // Normalizar presupuestos (por si clients viene como array)
      const normalizedBudgets = (budgets || []).map((b: any) => ({
        ...b,
        clients: Array.isArray(b.clients) ? b.clients[0] || null : b.clients || null
      }))

      setRecentBudgets(normalizedBudgets.slice(0, 5))
      setClients(sellerClients || [])

    } catch (error: any) {
      toast.error('Error cargando ficha: ' + error.message)
    } finally {
      setLoading(false)
    }
  }
  
  async function saveCommission() {
    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('users_profiles')
        .update({ commission_percentage: commissionPercentage })
        .eq('id', sellerId)
        
      if (error) throw error
      toast.success('Porcentaje de comisión actualizado.')
    } catch (err: any) {
      toast.error('Error al actualizar comisión.')
    } finally {
      setIsUpdating(false)
    }
  }

  const conversionRate = useMemo(() => {
    if (stats.totalBudgets === 0) return 0
    return ((stats.totalOrders / stats.totalBudgets) * 100).toFixed(1)
  }, [stats])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!seller) return null

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-6">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[2.5rem] bg-slate-950 text-white font-black text-4xl shadow-2xl">
            {seller.full_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <Link 
              href="/vendedores" 
              className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 transition"
            >
              <ArrowLeft size={14} /> Volver al equipo
            </Link>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">{seller.full_name}</h1>
            <div className="mt-2 flex flex-wrap gap-4 items-center">
               <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 border border-emerald-100">
                 <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                 Vendedor Activo
               </span>
               
               <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                 <FilterButton active={daysFilter === '7'} onClick={() => setDaysFilter('7')}>7D</FilterButton>
                 <FilterButton active={daysFilter === '30'} onClick={() => setDaysFilter('30')}>30D</FilterButton>
                 <FilterButton active={daysFilter === '90'} onClick={() => setDaysFilter('90')}>90D</FilterButton>
                 <FilterButton active={daysFilter === 'all'} onClick={() => setDaysFilter('all')}>Todo</FilterButton>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Info Cards Grid */}
      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
        <div className="md:col-span-1 space-y-6">
           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Información de Contacto</h3>
              <div className="space-y-4">
                 <ContactItem icon={Mail} label="Email" value={seller.email || 'vendedor@sistema.com'} />
                 <ContactItem icon={Phone} label="Teléfono" value={seller.phone || 'No especificado'} />
                 <ContactItem icon={MapPin} label="Dirección" value={seller.address || 'No especificada'} />
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Comisión</h3>
                 <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Percent size={14} />
                 </div>
              </div>
              
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Porcentaje (%)</label>
                    <div className="flex gap-2">
                       <input 
                          type="number" 
                          value={commissionPercentage}
                          onChange={(e) => setCommissionPercentage(Number(e.target.value))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 focus:border-blue-500 outline-none transition"
                          placeholder="0"
                       />
                       <button 
                          onClick={saveCommission}
                          disabled={isUpdating}
                          className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 transition disabled:opacity-50 shrink-0"
                       >
                          {isUpdating ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
                       </button>
                    </div>
                 </div>

                 <div className="pt-2 border-t border-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">A Liquidar ({daysFilter === 'all' ? 'Histórico' : `Últimos ${daysFilter}D`})</p>
                    <p className="text-2xl font-black text-emerald-600">
                       ${((stats.totalConfirmedAmount * commissionPercentage) / 100).toLocaleString('es-AR')}
                     </p>
                     <p className="text-[9px] font-bold text-slate-400 mt-1 italic">
                        Calculado sobre ${stats.totalConfirmedAmount.toLocaleString('es-AR')} confirmados.
                     </p>
                  </div>
               </div>
            </div>

           <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-7 rounded-[2rem] text-white shadow-xl shadow-blue-600/20">
              <div className="flex items-center gap-3 mb-4">
                 <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                    <Target size={20} />
                 </div>
                 <h3 className="font-black text-lg">Conversión</h3>
              </div>
              <p className="text-4xl font-black mb-1">{conversionRate}%</p>
              <p className="text-xs font-bold text-blue-100">Tasa de presupuestos convertidos en pedidos confirmados.</p>
           </div>
        </div>

        <div className="md:col-span-2 lg:col-span-3 grid gap-6">
           {/* Stats Summary */}
           <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard 
                icon={FileText} 
                label="Presupuestado" 
                value={`$${stats.totalBudgetedAmount.toLocaleString('es-AR')}`} 
                detail={`${stats.totalBudgets} presupuestos`}
              />
              <SummaryCard 
                icon={ClipboardList} 
                label="Confirmado" 
                value={`$${stats.totalConfirmedAmount.toLocaleString('es-AR')}`} 
                detail={`${stats.totalOrders} pedidos`}
                tone="emerald"
              />
              <SummaryCard 
                icon={Users} 
                label="Cartera" 
                value={stats.clientCount} 
                detail="Clientes asignados"
                tone="purple"
              />
           </div>

           {/* Listas Inferiores */}
           <div className="grid gap-6 lg:grid-cols-2">
              {/* Actividad Reciente */}
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                 <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-black text-slate-900 flex items-center gap-2">
                       <Clock3 size={18} className="text-blue-600" /> Actividad Reciente
                    </h3>
                 </div>
                 <div className="divide-y divide-slate-50">
                    {recentBudgets.length === 0 ? (
                       <div className="p-10 text-center text-slate-400 font-bold italic">Sin actividad registrada.</div>
                    ) : (
                       recentBudgets.map((b) => (
                          <div key={b.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition">
                             <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate">{b.clients?.name || 'Cliente sin nombre'}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                   Presupuesto · {new Date(b.created_at).toLocaleDateString()}
                                </p>
                             </div>
                             <div className="text-right">
                                <p className="text-sm font-black text-slate-950">${b.total_amount?.toLocaleString('es-AR')}</p>
                                <StatusBadge status={b.status} />
                             </div>
                          </div>
                       ))
                    )}
                 </div>
              </div>

              {/* Clientes Asignados */}
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                 <div className="p-6 border-b border-slate-100">
                    <h3 className="font-black text-slate-900 flex items-center gap-2">
                       <Users size={18} className="text-purple-600" /> Clientes Asignados
                    </h3>
                 </div>
                 <div className="divide-y divide-slate-50">
                    {clients.length === 0 ? (
                       <div className="p-10 text-center text-slate-400 font-bold italic">No tiene clientes asignados.</div>
                    ) : (
                       clients.map((c) => (
                          <Link key={c.id} href={`/clientes/${c.id}`} className="p-5 flex items-center justify-between hover:bg-slate-50 transition group">
                             <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate group-hover:text-blue-600 transition">{c.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">CUIT: {c.cuit || '-'}</p>
                             </div>
                             <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition" />
                          </Link>
                       ))
                    )}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}

function ContactItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
   return (
      <div className="flex items-start gap-3">
         <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
            <Icon size={14} />
         </div>
         <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
            <p className="text-sm font-bold text-slate-700 truncate">{value}</p>
         </div>
      </div>
   )
}

function SummaryCard({ icon: Icon, label, value, detail, tone = 'blue' }: any) {
   const colors: any = {
      blue: 'bg-blue-50 text-blue-600 border-blue-100',
      emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      purple: 'bg-purple-50 text-purple-600 border-purple-100'
   }
   return (
      <div className={`p-6 rounded-[2rem] border ${colors[tone]} shadow-sm`}>
         <div className="flex items-center gap-3 mb-3">
            <Icon size={18} strokeWidth={2.5} />
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</span>
         </div>
         <p className="text-2xl font-black tracking-tight mb-1 text-slate-900">{value}</p>
         <p className="text-[10px] font-bold opacity-60 text-slate-500">{detail}</p>
      </div>
   )
}

function FilterButton({ children, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
        active 
          ? 'bg-white text-slate-900 shadow-sm' 
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    approved: { label: 'Aprobado', color: 'text-emerald-500' },
    confirmed: { label: 'Confirmado', color: 'text-emerald-500' },
    issued: { label: 'Emitido', color: 'text-blue-500' },
    cancelled: { label: 'Cancelado', color: 'text-red-500' },
  }
  const config = configs[status] || configs.issued
  return <span className={`text-[8px] font-black uppercase tracking-widest ${config.color}`}>{config.label}</span>
}
