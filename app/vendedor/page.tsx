'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { 
  Users, 
  FileText, 
  ClipboardList, 
  TrendingUp, 
  PlusCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react'
import Link from 'next/link'

export default function VendedorDashboard() {
  const [stats, setStats] = useState({
    clients: 0,
    budgets: 0,
    orders: 0
  })
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      setRole(profile?.role || 'vendedor')
      const isAdmin = profile?.role === 'admin'

      // Definir queries base
      let clientsQuery = supabase.from('clients').select('id', { count: 'exact', head: true })
      let budgetsQuery = supabase.from('budgets').select('id', { count: 'exact', head: true })
      let ordersQuery = supabase.from('orders').select('id', { count: 'exact', head: true })

      // Si NO es admin, filtrar por su propio ID
      if (!isAdmin) {
        clientsQuery = clientsQuery.eq('seller_id', user.id)
        budgetsQuery = budgetsQuery.eq('seller_id', user.id)
        ordersQuery = ordersQuery.eq('seller_id', user.id)
      }

      const [clientsCount, budgetsCount, ordersCount] = await Promise.all([
        clientsQuery,
        budgetsQuery,
        ordersQuery
      ])

      setStats({
        clients: clientsCount.count || 0,
        budgets: budgetsCount.count || 0,
        orders: ordersCount.count || 0
      })
      setLoading(false)
    }
    loadStats()
  }, [])

  return (
    <div className="space-y-8">
      {/* Bienvenida */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden border border-white/5">
        <div className="absolute right-0 top-0 h-64 w-64 bg-blue-600/20 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            {role === 'admin' ? (
              <span className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/30">
                <ShieldCheck size={12} /> Modo Administrador
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
                Modo Vendedor
              </span>
            )}
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-2">Panel de Ventas</h2>
          <p className="text-slate-400 font-medium max-w-md">
            {role === 'admin' 
              ? 'Visualizando el rendimiento global de la empresa.' 
              : 'Gestiona tus clientes y ventas de forma rápida.'}
          </p>
          
          <div className="mt-8 flex flex-wrap gap-4">
            <Link 
              href="/vendedor/presupuestos/nuevo" 
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-blue-500 transition border border-blue-400/30"
            >
              <PlusCircle size={20} />
              Nuevo Presupuesto
            </Link>
            {role === 'admin' && (
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 bg-white/5 text-white px-6 py-3 rounded-2xl font-black hover:bg-white/10 transition border border-white/10"
              >
                Volver al CRM
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Stats Rapidas */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={Users} 
          title={role === 'admin' ? "Total Clientes" : "Mis Clientes"} 
          value={loading ? '...' : stats.clients} 
          href="/vendedor/clientes"
          color="bg-purple-600"
        />
        <StatCard 
          icon={FileText} 
          title={role === 'admin' ? "Total Presupuestos" : "Mis Presupuestos"} 
          value={loading ? '...' : stats.budgets} 
          href="/vendedor/presupuestos"
          color="bg-blue-600"
        />
        <StatCard 
          icon={ClipboardList} 
          title={role === 'admin' ? "Total Pedidos" : "Mis Pedidos"} 
          value={loading ? '...' : stats.orders} 
          href="/vendedor/pedidos"
          color="bg-emerald-600"
        />
      </section>

      {/* Accesos Rápidos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={20} />
            Accesos Directos
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <QuickAction href="/vendedor/clientes/nuevo" label="Crear Cliente" />
            <QuickAction href="/vendedor/presupuestos" label="Ver Listado" />
          </div>
        </div>

        <div className="bg-blue-600 p-7 rounded-[2rem] text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10">
             <TrendingUp size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="text-xl font-black mb-2">¿Necesitas Ayuda?</h3>
            <p className="text-blue-100 text-sm font-medium mb-8">El equipo de soporte técnico está disponible para asistirte con cualquier duda sobre el nuevo portal.</p>
            <Link 
              href="https://wa.me/5491100000000" 
              target="_blank"
              className="inline-flex items-center justify-center w-full bg-white text-blue-600 px-5 py-4 rounded-2xl font-black transition hover:bg-blue-50 shadow-lg"
            >
              Hablar con Soporte
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon: Icon, title, value, href, color }: any) {
  return (
    <Link href={href} className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition group">
      <div className="flex items-center gap-5">
        <div className={`h-14 w-14 rounded-2xl ${color} text-white flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform`}>
          <Icon size={28} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{title}</p>
          <p className="text-3xl font-black text-slate-900">{value}</p>
        </div>
      </div>
    </Link>
  )
}

function QuickAction({ href, label }: { href: string, label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-blue-50 hover:border-blue-200 transition group">
      <span className="text-sm font-black text-slate-700 group-hover:text-blue-700">{label}</span>
      <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
    </Link>
  )
}
