'use client'

import { useState, useEffect } from 'react'
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

  const cards = [
    { title: 'Clientes', value: stats.clients, icon: Users, href: '/clientes', detail: 'Base comercial activa' },
    { title: 'Productos', value: stats.products, icon: Package, href: '/productos', detail: 'Lista de precios' },
    { title: 'Presupuestos', value: stats.budgets, icon: FileText, href: '/presupuestos', detail: 'Emitidos' },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-blue-300">Panel de Control</p>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight lg:text-5xl">Gestión comercial unificada.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Bienvenido al centro de mando. Aquí tienes el panorama completo de tu empresa.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row items-center">
            <div className="flex items-center gap-2 bg-white/10 p-1 rounded-xl border border-white/10 backdrop-blur-md mr-4">
              <FilterButton variant="blue" active={daysFilter === '7'} onClick={() => setDaysFilter('7')}>7D</FilterButton>
              <FilterButton variant="blue" active={daysFilter === '30'} onClick={() => setDaysFilter('30')}>30D</FilterButton>
              <FilterButton variant="blue" active={daysFilter === '90'} onClick={() => setDaysFilter('90')}>90D</FilterButton>
              <FilterButton variant="blue" active={daysFilter === 'all'} onClick={() => setDaysFilter('all')}>Todo</FilterButton>
            </div>
            <button
              onClick={toggleHero}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/20"
            >
              <BarChart3 size={18} />
              Personalizar
            </button>
            <Link href="/clientes/nuevo" className="ml-3 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-900/30 transition hover:bg-blue-500 active:scale-95"><Plus size={18} /> Nuevo cliente</Link>
          </div>
        </div>
      </section>

      {heroType === 'balance' ? (
        <section className="relative overflow-hidden rounded-[2rem] bg-emerald-950 p-8 text-white shadow-2xl">
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-400 shadow-inner"><Wallet size={32} /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">Saldo Global Cuenta Corriente</p>
                <h2 className="mt-1 text-4xl font-black tracking-tight lg:text-5xl">{`$${stats.balance.toLocaleString('es-AR')}`}</h2>
              </div>
            </div>
            <Link href="/cuenta-corriente" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-emerald-950 shadow-xl transition hover:bg-emerald-50 active:scale-95">Ver detalle completo <ArrowRight size={18} /></Link>
          </div>
        </section>
      ) : (
        <section className="relative overflow-hidden rounded-[2rem] bg-indigo-950 p-8 text-white shadow-2xl border border-white/10">
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-4">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400">Rendimiento de Ventas</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                  <p className="text-sm font-bold text-slate-400">Total Presupuestado</p>
                  <h3 className="text-3xl font-black mt-1">${stats.totalBudgeted.toLocaleString('es-AR')}</h3>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-400">Total Convertido</p>
                  <h3 className="text-3xl font-black mt-1 text-indigo-400">${stats.totalConverted.toLocaleString('es-AR')}</h3>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-400">Rentabilidad Bruta</p>
                  <h3 className="text-3xl font-black mt-1 text-emerald-400">
                    ${stats.profitability.toLocaleString('es-AR')}
                    <span className="ml-2 text-sm font-bold opacity-60">
                      ({stats.totalConverted > 0 ? ((stats.profitability / stats.totalConverted) * 100).toFixed(1) : 0}%)
                    </span>
                  </h3>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-400">Tasa de Cierre </p>
                  <h3 className="text-3xl font-black mt-1 text-blue-400">{stats.conversionRate.toFixed(1)}%</h3>
                </div>
              </div>
            </div>
            <Link href="/presupuestos" className="inline-flex h-16 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-8 text-sm font-black text-white shadow-xl shadow-indigo-900/40 transition hover:bg-indigo-500 active:scale-95">Ver presupuestos <ArrowRight size={18} /></Link>
          </div>
        </section>
      )}

      <section className="grid gap-5 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.title} href={card.href} className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon size={23} /></div>
                <ArrowRight size={18} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />
              </div>
              <p className="text-sm font-bold text-slate-500">{card.title}</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">{card.value}</h2>
              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{daysFilter === 'all' ? 'Histórico total' : `Últimos ${daysFilter} días`}</p>
            </Link>
          )
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><BarChart3 size={20} /></div>
            <div><h3 className="text-lg font-black text-slate-950">Ventas históricas</h3><p className="text-sm font-medium text-slate-500">Volumen facturado global</p></div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.salesHistory}>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><PieIcon size={20} /></div>
              <h3 className="text-lg font-black text-slate-950">Estado de cobros</h3>
            </div>
            <div className="flex h-44 items-center justify-center">
              <div className="flex h-full w-full items-center">
                <div className="h-full w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.paymentStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                        {stats.paymentStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2">
                  {stats.paymentStatus.map((s) => (
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
