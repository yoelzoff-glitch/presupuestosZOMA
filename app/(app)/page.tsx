'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  Package,
  FileText,
  Wallet,
  TrendingUp,
  ArrowRight,
  Plus,
  BarChart3,
  PieChart as PieIcon,
  ShoppingCart,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
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

type DashboardStats = {
  clients: number
  products: number
  budgets: number
  balance: number
  salesHistory: { month: string; total: number }[]
  topProducts: { name: string; quantity: number }[]
  paymentStatus: { name: string; value: number; color: string }[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    clients: 0,
    products: 0,
    budgets: 0,
    balance: 0,
    salesHistory: [],
    topProducts: [],
    paymentStatus: [],
  })

  const [loading, setLoading] = useState(true)
  const [daysFilter, setDaysFilter] = useState('30')

  useEffect(() => {
    loadDashboard()
  }, [daysFilter])

  async function loadDashboard() {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      setLoading(false); return
    }

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()

    if (!profile?.company_id) {
      setLoading(false); return
    }

    const companyId = profile.company_id

    // Dashboard 100% Admin - Filtros de fecha dinámicos
    let budgetsQuery = supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    let movementsQuery = supabase.from('account_movements').select('debit, credit').eq('company_id', companyId)
    let historyQuery = supabase.from('budgets').select('created_at, total_amount, payment_status').eq('company_id', companyId).neq('status', 'cancelled')
    let itemsQuery = supabase.from('budget_items').select('product_name, quantity, budgets!inner(company_id, created_at)').eq('budgets.company_id', companyId)

    if (daysFilter !== 'all') {
      const dateLimit = new Date()
      dateLimit.setDate(dateLimit.getDate() - parseInt(daysFilter))
      const isoDate = dateLimit.toISOString()
      
      budgetsQuery = budgetsQuery.gte('created_at', isoDate)
      movementsQuery = movementsQuery.gte('created_at', isoDate)
      historyQuery = historyQuery.gte('created_at', isoDate)
      itemsQuery = itemsQuery.gte('budgets.created_at', isoDate)
    }

    const [
      clientsRes,
      productsRes,
      budgetsRes,
      balanceRes,
      historyRes,
      itemsRes,
    ] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      budgetsQuery,
      movementsQuery,
      historyQuery,
      itemsQuery,
    ])

    const totalBalance = balanceRes.data?.reduce((acc, item: any) => acc + (Number(item.debit || 0) - Number(item.credit || 0)), 0) ?? 0

    // Historial
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const historyMap: Record<string, number> = {}
    historyRes.data?.forEach(b => {
      if (!b.created_at) return
      const date = new Date(b.created_at)
      const key = `${months[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`
      historyMap[key] = (historyMap[key] || 0) + Number(b.total_amount || 0)
    })

    const salesHistory = Object.entries(historyMap).map(([month, total]) => ({ month, total })).reverse().slice(-6)

    // Top Products
    const productMap: Record<string, number> = {}
    itemsRes.data?.forEach(item => {
      productMap[item.product_name] = (productMap[item.product_name] || 0) + Number(item.quantity || 0)
    })

    const topProducts = Object.entries(productMap).map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5)

    // Estados de Pago
    const statusCounts = { paid: 0, partial: 0, unpaid: 0 }
    historyRes.data?.forEach(b => {
      const s = (b.payment_status || 'unpaid') as keyof typeof statusCounts
      if (statusCounts[s] !== undefined) statusCounts[s]++
    })

    const paymentStatus = [
      { name: 'Pagados', value: statusCounts.paid, color: '#10b981' },
      { name: 'Parciales', value: statusCounts.partial, color: '#f59e0b' },
      { name: 'Pendientes', value: statusCounts.unpaid, color: '#ef4444' },
    ].filter(s => s.value > 0)

    setStats({
      clients: clientsRes.count ?? 0,
      products: productsRes.count ?? 0,
      budgets: budgetsRes.count ?? 0,
      balance: totalBalance,
      salesHistory,
      topProducts,
      paymentStatus,
    })

    setLoading(false)
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
              <FilterButton active={daysFilter === '7'} onClick={() => setDaysFilter('7')}>7D</FilterButton>
              <FilterButton active={daysFilter === '30'} onClick={() => setDaysFilter('30')}>30D</FilterButton>
              <FilterButton active={daysFilter === '90'} onClick={() => setDaysFilter('90')}>90D</FilterButton>
              <FilterButton active={daysFilter === 'all'} onClick={() => setDaysFilter('all')}>Todo</FilterButton>
            </div>
            <Link href="/clientes/nuevo" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-900/30 transition hover:bg-blue-500 active:scale-95"><Plus size={18} /> Nuevo cliente</Link>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] bg-emerald-950 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-400 shadow-inner"><Wallet size={32} /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">Saldo Global Cuenta Corriente</p>
              <h2 className="mt-1 text-4xl font-black tracking-tight lg:text-5xl">{loading ? '...' : `$${stats.balance.toLocaleString('es-AR')}`}</h2>
            </div>
          </div>
          <Link href="/cuenta-corriente" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-emerald-950 shadow-xl transition hover:bg-emerald-50 active:scale-95">Ver detalle completo <ArrowRight size={18} /></Link>
        </div>
      </section>

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
              <h2 className="mt-2 text-3xl font-black text-slate-950">{loading ? '...' : card.value}</h2>
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
              <div className="flex w-full items-center">
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