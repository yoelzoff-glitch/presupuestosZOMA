'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Users,
  Package,
  FileText,
  Wallet,
  ArrowRight,
  Plus,
  BarChart3,
  PieChart as PieIcon,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import FilterButton from '@/app/components/FilterButton'
import { useRouter, useSearchParams } from 'next/navigation'

type DashboardStats = {
  clients: number
  products: number
  budgets: number
  balance: number
  totalBudgeted: number
  totalConverted: number
  totalCost: number
  profitability: number
  conversionRate: number
  salesHistory: { month: string; total: number }[]
  topProducts: { name: string; quantity: number }[]
  paymentStatus: { name: string; value: number; color: string }[]
  budgetStatus?: { name: string; value: number; color: string }[]
}

export default function DashboardClient({ stats }: { stats: DashboardStats }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const daysFilter = searchParams.get('days') || '30'

  const [heroType, setHeroType] = useState<'balance' | 'performance'>('balance')

  useEffect(() => {
    const saved = localStorage.getItem('admin_dashboard_hero')
    if (saved) setHeroType(saved as any)
  }, [])

  const toggleHero = () => {
    const next = heroType === 'balance' ? 'performance' : 'balance'
    setHeroType(next)
    localStorage.setItem('admin_dashboard_hero', next)
  }

  const setDaysFilter = (days: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('days', days)
    router.push(`/?${params.toString()}`)
  }

  const formattedSalesHistory = useMemo(() => {
    const translationMap: { [key: string]: string } = {
      'Jan': 'Enero', 'Feb': 'Febrero', 'Mar': 'Marzo', 'Apr': 'Abril', 'May': 'Mayo', 'Jun': 'Junio',
      'Jul': 'Julio', 'Aug': 'Agosto', 'Sep': 'Septiembre', 'Oct': 'Octubre', 'Nov': 'Noviembre', 'Dec': 'Diciembre',
      'ene': 'Enero', 'feb': 'Febrero', 'mar': 'Marzo', 'abr': 'Abril', 'may': 'Mayo', 'jun': 'Junio',
      'jul': 'Julio', 'ago': 'Agosto', 'sep': 'Septiembre', 'oct': 'Octubre', 'nov': 'Noviembre', 'dic': 'Diciembre'
    }

    return (stats?.salesHistory ?? []).map(item => {
      const parts = item.month.split(' ')
      if (parts.length === 2) {
        const [monthAbbr, yearYY] = parts
        const fullMonth = translationMap[monthAbbr] || translationMap[monthAbbr.toLowerCase()] || monthAbbr
        const fullYear = yearYY.length === 2 ? `20${yearYY}` : yearYY
        return {
          ...item,
          month: `${fullMonth} ${fullYear}`
        }
      }
      return item
    })
  }, [stats?.salesHistory])

  const formattedBudgetStatus = useMemo(() => {
    return stats?.budgetStatus ?? []
  }, [stats?.budgetStatus])

  const cards = [
    { title: 'Clientes', value: stats.clients, icon: Users, href: '/clientes', detail: 'Base comercial activa' },
    { title: 'Productos', value: stats.products, icon: Package, href: '/productos', detail: 'Lista de precios' },
    { title: 'Presupuestos', value: stats.budgets, icon: FileText, href: '/presupuestos', detail: 'Emitidos' },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 text-white shadow-2xl border border-white/[0.05]">
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-mono font-bold uppercase tracking-[0.25em] text-blue-400">Panel de Control</p>
            <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight lg:text-5xl font-sans">Gestión comercial unificada.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-350 font-sans">Bienvenido al centro de mando. Aquí tienes el panorama completo de tu empresa.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row items-center">
            {heroType !== 'balance' && (
              <div className="flex items-center gap-1.5 bg-white/[0.05] p-1.5 rounded-xl border border-white/[0.05] backdrop-blur-md mr-2">
                <FilterButton variant="blue" active={daysFilter === '7'} onClick={() => setDaysFilter('7')}>7D</FilterButton>
                <FilterButton variant="blue" active={daysFilter === '30'} onClick={() => setDaysFilter('30')}>30D</FilterButton>
                <FilterButton variant="blue" active={daysFilter === '90'} onClick={() => setDaysFilter('90')}>90D</FilterButton>
                <FilterButton variant="blue" active={daysFilter === 'all'} onClick={() => setDaysFilter('all')}>Todo</FilterButton>
              </div>
            )}
            <button
              onClick={toggleHero}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4.5 text-xs font-bold text-white transition hover:bg-white/[0.1] active:scale-98"
            >
              <BarChart3 size={15} strokeWidth={2} />
              Personalizar
            </button>
            <Link href="/clientes/nuevo" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 active:scale-95"><Plus size={16} strokeWidth={2.5} /> Nuevo cliente</Link>
          </div>
        </div>
      </section>
 
       {heroType === 'balance' ? (
         <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#022c22] p-8 text-white shadow-2xl border border-emerald-500/20">
           <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-[100px] pointer-events-none" />
           <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
             <div className="flex items-center gap-5">
               <div className="relative flex h-15 w-15 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400 shadow-inner border border-emerald-400/25 ring-4 ring-emerald-500/5">
                 <Wallet size={26} strokeWidth={1.75} className="fill-emerald-400/10" />
               </div>
               <div>
                 <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-emerald-450">Saldo Global Cuenta Corriente</p>
                 <h2 className="mt-1 text-3xl md:text-4xl font-mono font-bold tracking-tight text-white">{`$${(stats?.balance ?? 0).toLocaleString('es-AR')}`}</h2>
               </div>
             </div>
             <Link href="/cuenta-corriente" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5.5 py-3 text-xs font-bold text-emerald-950 shadow-lg hover:bg-emerald-50 active:scale-95 transition-all duration-200">Ver detalle completo <ArrowRight size={15} strokeWidth={2.5} /></Link>
           </div>
         </section>
       ) : (
         <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0c0a09] via-[#1e1b4b] to-[#0c0a09] p-8 text-white shadow-2xl border border-indigo-500/20">
           <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-indigo-500/20 blur-[100px] pointer-events-none" />
           <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
             <div className="flex-1 space-y-4">
               <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-indigo-400">Rendimiento de Ventas</p>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                 <div>
                   <p className="text-xs font-semibold text-slate-400">Total Presupuestado</p>
                   <h3 className="text-2xl font-mono font-bold mt-1 text-white">${(stats?.totalBudgeted ?? 0).toLocaleString('es-AR')}</h3>
                 </div>
                 <div>
                   <p className="text-xs font-semibold text-slate-400">Total Convertido</p>
                   <h3 className="text-2xl font-mono font-bold mt-1 text-indigo-450">${(stats?.totalConverted ?? 0).toLocaleString('es-AR')}</h3>
                 </div>
                 <div>
                   <p className="text-xs font-semibold text-slate-400">Rentabilidad Bruta</p>
                   <h3 className="text-2xl font-mono font-bold mt-1 text-emerald-400">
                     ${(stats?.profitability ?? 0).toLocaleString('es-AR')}
                     <span className="ml-2 text-xs font-bold opacity-60 text-emerald-450">
                       ({(stats?.totalConverted ?? 0) > 0 ? (((stats?.profitability ?? 0) / (stats?.totalConverted ?? 1)) * 100).toFixed(1) : 0}%)
                     </span>
                   </h3>
                 </div>
                 <div>
                   <p className="text-xs font-semibold text-slate-400">Tasa de Cierre </p>
                   <h3 className="text-2xl font-mono font-bold mt-1 text-blue-400">{(stats?.conversionRate ?? 0).toFixed(1)}%</h3>
                 </div>
               </div>
             </div>
             <Link href="/presupuestos" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-650 px-6 text-xs font-bold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-600 active:scale-95">Ver presupuestos <ArrowRight size={15} strokeWidth={2.5} /></Link>
           </div>
         </section>
       )}
 
       <section className="grid gap-5 md:grid-cols-3">
         {cards.map((card) => {
           const Icon = card.icon
            const colorsMap: any = {
              'Clientes': { from: 'from-blue-50/50', to: 'to-blue-100/50', text: 'text-blue-600', border: 'border-blue-100', ring: 'ring-blue-50/30', fill: 'fill-blue-600/10' },
              'Productos': { from: 'from-indigo-50/50', to: 'to-indigo-100/50', text: 'text-indigo-600', border: 'border-indigo-100', ring: 'ring-indigo-50/30', fill: 'fill-indigo-600/10' },
              'Presupuestos': { from: 'from-purple-50/50', to: 'to-purple-100/50', text: 'text-purple-600', border: 'border-purple-100', ring: 'ring-purple-50/30', fill: 'fill-purple-600/10' },
            }
            const colors = colorsMap[card.title] || colorsMap['Clientes']
           return (
             <Link key={card.title} href={card.href} className="group rounded-[2rem] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(15,23,42,0.08)] hover:border-blue-200/60 backdrop-blur-md">
               <div className="mb-6 flex items-center justify-between">
                 <div className={`relative flex h-13 w-13 items-center justify-center rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.from} ${colors.to} ${colors.text} shadow-[0_8px_20px_-6px_rgba(37,99,235,0.15)] ring-4 ring-offset-0 ${colors.ring}`}><Icon size={22} strokeWidth={1.75} className={colors.fill} /></div>
                 <ArrowRight size={18} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />
               </div>
               <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{card.title}</p>
               <h2 className="mt-2 text-4xl font-mono font-bold tracking-tight text-slate-950">{card.value}</h2>
               <p className="mt-2 text-[9px] font-mono tracking-widest uppercase text-slate-400">{daysFilter === 'all' ? 'Histórico total' : `Últimos ${daysFilter} días`}</p>
             </Link>
           )
         })}
       </section>
 
       <section className="grid gap-6 lg:grid-cols-2">
         <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
           <div className="mb-6 flex items-center gap-3">
             <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-blue-100/50 text-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.08)] ring-4 ring-blue-500/5"><BarChart3 size={18} strokeWidth={1.75} className="fill-blue-600/5" /></div>
             <div><h3 className="text-lg font-black text-slate-950">Ventas históricas</h3><p className="text-sm font-medium text-slate-500">Volumen facturado global</p></div>
           </div>
           <div className="h-72 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={formattedSalesHistory}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} tickFormatter={(value) => `$${value / 1000}k`} />
                 <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                 <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={40} />
               </BarChart>
             </ResponsiveContainer>
           </div>
         </div>
 
         <div className="grid gap-6">
           <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
             <div className="mb-4 flex items-center gap-3">
               <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-emerald-100/50 text-emerald-600 shadow-[0_4px_12px_rgba(16,185,129,0.08)] ring-4 ring-emerald-500/5"><PieIcon size={18} strokeWidth={1.75} className="fill-emerald-600/5" /></div>
               <h3 className="text-lg font-black text-slate-950">Conversión de Presupuestos</h3>
             </div>
             <div className="flex h-44 items-center justify-center">
               <div className="flex h-full w-full items-center">
                 <div className="h-full w-1/2">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={formattedBudgetStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                         {formattedBudgetStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                       </Pie>
                       <Tooltip />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
                 <div className="w-1/2 space-y-2">
                   {formattedBudgetStatus.map((s) => (
                     <div key={s.name} className="flex items-center justify-between">
                       <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /><span className="text-xs font-bold text-slate-600">{s.name}</span></div>
                       <span className="text-xs font-black text-slate-900">{s.value}</span>
                     </div>
                   ))}
                 </div>
               </div>
             </div>
           </div>
         </div>
       </section>
    </div>
  )
}
