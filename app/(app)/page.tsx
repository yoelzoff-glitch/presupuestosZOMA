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
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

type DashboardStats = {
  clients: number
  products: number
  budgets: number
  balance: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    clients: 0,
    products: 0,
    budgets: 0,
    balance: 0,
  })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function getCompanyId() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) return null

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()

    return profile?.company_id ?? null
  }

  async function loadDashboard() {
    setLoading(true)

    const companyId = await getCompanyId()

    if (!companyId) {
      setLoading(false)
      return
    }

    const [
      clientsRes,
      productsRes,
      budgetsRes,
      balanceRes,
    ] = await Promise.all([
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId),

      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId),

      supabase
        .from('budgets')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .neq('status','cancelled'),

      supabase
        .from('client_account_balances')
        .select('balance')
        .eq('company_id', companyId)
        .neq('status','cancelled'),
    ])

    const totalBalance =
      balanceRes.data?.reduce((acc, item) => acc + Number(item.balance || 0), 0) ?? 0

    setStats({
      clients: clientsRes.count ?? 0,
      products: productsRes.count ?? 0,
      budgets: budgetsRes.count ?? 0,
      balance: totalBalance,
    })

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

      <section className="relative overflow-hidden rounded-[2rem] bg-emerald-950 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-200">
              <Wallet size={14} />
              Cuentas por Cobrar
            </div>

            <h2 className="text-sm font-bold text-emerald-300">Total pendiente de cobro</h2>
            
            <p className="mt-1 text-5xl font-black tracking-tight lg:text-6xl">
              {loading ? '...' : `$${stats.balance.toLocaleString('es-AR')}`}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/cuenta-corriente"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
            >
              Ver detalle de cobros
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

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

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950">
                Accesos rápidos
              </h3>
              <p className="text-sm text-slate-500">
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
              href="/productos"
              title="Ver productos"
              description="Consultar lista de precios y proveedores."
            />
            <QuickAction
              href="/productos/aumentos"
              title="Actualizar precios"
              description="Aplicar aumentos por proveedor o producto."
            />
            <QuickAction
              href="/presupuestos"
              title="Crear presupuesto"
              description="Armar presupuesto con productos e importes."
            />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <TrendingUp size={24} />
          </div>

          <h3 className="mt-5 text-xl font-black text-slate-950">
            Estado general
          </h3>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Tu sistema ya tiene la base lista para operar con clientes,
            productos, presupuestos y cuenta corriente.
          </p>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Próximo módulo
            </p>
            <p className="mt-1 font-black text-slate-900">
              Presupuestos
            </p>
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