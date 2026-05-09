'use client'

import { useEffect, useState, useMemo } from 'react'
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
  Legend,
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
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id, role')
      .eq('id', userData.user.id)
      .single()

    if (!profile?.company_id) {
      setLoading(false)
      return
    }

    const companyId = profile.company_id
    const isVendedor = profile.role === 'vendedor'

    const [
      clientsRes,
      productsRes,
      budgetsRes,
      balanceRes,
      historyRes,
      itemsRes,
    ] = await Promise.all([
      // Clients: Filter if vendor
      isVendedor 
        ? supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('seller_id', userData.user.id)
        : supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', companyId),

      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId),

      // Budgets: Filter if vendor
      isVendedor
        ? supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('seller_id', userData.user.id)
        : supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('company_id', companyId),

      // Balance: Zero out for vendor
      isVendedor
        ? Promise.resolve({ data: [], error: null })
        : supabase.from('account_movements').select('debit, credit').eq('company_id', companyId),

      // History: Filter if vendor
      isVendedor
        ? supabase.from('budgets').select('created_at, total_amount, payment_status').eq('company_id', companyId).eq('seller_id', userData.user.id).neq('status', 'cancelled')
        : supabase.from('budgets').select('created_at, total_amount, payment_status').eq('company_id', companyId).neq('status', 'cancelled'),

      // Top Products: Filter if vendor (via budgets items joining)
      isVendedor
        ? supabase.from('budget_items').select('product_name, quantity, budgets!inner(company_id, seller_id)').eq('budgets.company_id', companyId).eq('budgets.seller_id', userData.user.id)
        : supabase.from('budget_items').select('product_name, quantity, budgets!inner(company_id)').eq('budgets.company_id', companyId),
    ])

    const totalBalance =
      balanceRes.data?.reduce(
        (acc, item: any) =>
          acc + (Number(item.debit || 0) - Number(item.credit || 0)),
        0
      ) ?? 0

    // Procesar historial de ventas (últimos meses)
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const historyMap: Record<string, number> = {}
    
    historyRes.data?.forEach(b => {
      if (!b.created_at) return
      const date = new Date(b.created_at)
      const key = `${months[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`
      historyMap[key] = (historyMap[key] || 0) + Number(b.total_amount || 0)
    })

    const salesHistory = Object.entries(historyMap)
      .map(([month, total]) => ({ month, total }))
      .reverse()
      .slice(-6)

    // Procesar productos más vendidos
    const productMap: Record<string, number> = {}
    itemsRes.data?.forEach(item => {
      productMap[item.product_name] = (productMap[item.product_name] || 0) + Number(item.quantity || 0)
    })

    const topProducts = Object.entries(productMap)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    // Procesar estados de pago
    const statusCounts = {
      paid: 0,
      partial: 0,
      unpaid: 0
    }
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

    setRole(profile.role)
    setLoading(false)
  }

  const cards = [
    {
      title: 'Clientes',
      value: stats.clients,
      icon: Users,
      href: '/clientes',
      detail: 'Base comercial activa',
    },
    {
      title: 'Productos',
      value: stats.products,
      icon: Package,
      href: '/productos',
      detail: 'Lista de precios cargada',
    },
    {
      title: 'Presupuestos',
      value: stats.budgets,
      icon: FileText,
      href: '/presupuestos',
      detail: 'Presupuestos registrados',
    },
  ]

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-blue-300">
              ERP Comercial
            </p>

            <h1 className="max-w-3xl text-4xl font-black tracking-tight lg:text-5xl">
              Gestión clara para presupuestos, clientes y cuenta corriente.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Panel general del sistema. Desde acá podés controlar tus clientes,
              productos, presupuestos y saldos comerciales.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/clientes/nuevo"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
            >
              <Plus size={18} />
              Nuevo cliente
            </Link>

            <Link
              href="/presupuestos"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
            >
              Ver presupuestos
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      {role === 'admin' && (
        <section className="relative overflow-hidden rounded-[2rem] bg-emerald-950 p-8 text-white shadow-2xl">
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-20 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-400 shadow-inner">
                <Wallet size={32} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">
                  Saldo de Cuenta Corriente
                </p>
                <h2 className="mt-1 text-4xl font-black tracking-tight lg:text-5xl">
                  {loading ? (
                    <span className="opacity-50">...</span>
                  ) : (
                    `$${stats.balance.toLocaleString('es-AR')}`
                  )}
                </h2>
              </div>
            </div>

            <Link
              href="/cuenta-corriente"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-emerald-950 shadow-xl transition hover:bg-emerald-50 active:scale-95"
            >
              Ver detalle completo
              <ArrowRight size={18} strokeWidth={3} />
            </Link>
          </div>
        </section>
      )}

      <section className="grid gap-5 md:grid-cols-3 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <Link
              key={card.title}
              href={card.href}
              className="group rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Icon size={23} />
                </div>

                <ArrowRight
                  size={18}
                  className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600"
                />
              </div>

              <p className="text-sm font-bold text-slate-500">{card.title}</p>

              <h2 className="mt-2 text-3xl font-black text-slate-950">
                {loading ? '...' : card.value}
              </h2>

              <p className="mt-2 text-sm text-slate-500">{card.detail}</p>
            </Link>
          )
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {/* Gráfico de Ventas */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950">Ventas históricas</h3>
              <p className="text-sm font-medium text-slate-500">Volumen facturado por mes</p>
            </div>
          </div>

          <div className="h-72 w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">
                Cargando gráfico...
              </div>
            ) : stats.salesHistory.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-medium text-slate-400">
                Sin datos suficientes
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.salesHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(value) => `$${value / 1000}k`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`$${Number(value).toLocaleString('es-AR')}`, 'Ventas']}
                  />
                  <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico de Productos / Estados de Pago */}
        <div className="grid gap-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <PieIcon size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-950">Estado de cobros</h3>
            </div>
            
            <div className="flex h-44 items-center justify-center">
              {loading ? (
                <div className="text-sm font-bold text-slate-400">Cargando...</div>
              ) : stats.paymentStatus.length === 0 ? (
                <div className="text-sm font-medium text-slate-400">Sin datos</div>
              ) : (
                <div className="flex w-full items-center">
                  <div className="h-full w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.paymentStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats.paymentStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-2">
                    {stats.paymentStatus.map((s) => (
                      <div key={s.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="text-xs font-bold text-slate-600">{s.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-900">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <ShoppingCart size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-950">Top Productos</h3>
            </div>
            
            <div className="space-y-3">
              {loading ? (
                <div className="py-4 text-center text-sm font-bold text-slate-400">Cargando...</div>
              ) : stats.topProducts.length === 0 ? (
                <div className="py-4 text-center text-sm font-medium text-slate-400">Sin ventas aún</div>
              ) : (
                stats.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-500">
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="truncate text-xs font-bold text-slate-700">{p.name}</p>
                        <p className="text-xs font-black text-slate-950">{p.quantity} u.</p>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div 
                          className="h-full bg-orange-400 rounded-full" 
                          style={{ width: `${(p.quantity / stats.topProducts[0].quantity) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm lg:col-span-2">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950">
                Accesos rápidos
              </h3>
              <p className="text-sm font-medium text-slate-500">
                Operaciones principales del sistema
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <QuickAction
              href="/clientes/nuevo"
              title="Registrar cliente"
              description="Alta rápida con CUIT, nombre y dirección."
            />
            <QuickAction
              href="/presupuestos"
              title="Crear presupuesto"
              description="Armar presupuesto con productos e importes."
            />
            {role === 'admin' && (
              <>
                <QuickAction
                  href="/productos"
                  title="Ver productos"
                  description="Consultar lista de precios y proveedores."
                />
                <QuickAction
                  href="/productos/aumentos"
                  title="Actualizar precios"
                  description="Aplicar aumentos por proveedor o producto."
                />
              </>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <TrendingUp size={24} />
          </div>

          <h3 className="mt-5 text-xl font-black text-slate-950">
            Estado comercial
          </h3>

          <p className="mt-4 text-sm font-medium leading-relaxed text-slate-500">
            Tu plataforma está sincronizada. Todos los pagos registrados impactan 
            automáticamente en el saldo de tus clientes y en estos reportes.
          </p>

          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
               <span className="text-xs font-bold text-slate-500 uppercase">Eficiencia de cobro</span>
               <span className="text-sm font-black text-emerald-600">Alta</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
               <span className="text-xs font-bold text-slate-500 uppercase">Actividad</span>
               <span className="text-sm font-black text-blue-600">Sincronizada</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function QuickAction({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-blue-200 hover:bg-blue-50"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-black text-slate-900">{title}</h4>
        <ArrowRight size={18} className="text-slate-400" />
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </Link>
  )
}