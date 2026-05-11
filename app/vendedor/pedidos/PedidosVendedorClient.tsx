'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Search,
  ClipboardList,
  RefreshCw,
  Eye,
  CalendarDays,
  CheckCircle2,
  Clock3,
  XCircle,
  Loader2,
  PackageCheck,
  ArrowRight,
  ShieldCheck
} from 'lucide-react'

type Order = {
  id: string
  order_number: number
  order_code: string
  order_date: string
  total_amount: number
  status: string
  client: {
    name: string
  } | null
}

type Props = {
  initialOrders: Order[]
  role: string
  userId: string
}

export default function PedidosVendedorClient({ initialOrders, role, userId }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function refreshOrders() {
    setRefreshing(true)
    const isAdmin = role === 'admin'

    let query = supabase
      .from('orders')
      .select(`
        id, order_number, order_code, order_date, total_amount, status,
        clients ( name )
      `)
      .order('order_number', { ascending: false })

    if (!isAdmin) {
      query = query.eq('seller_id', userId)
    }

    const { data, error } = await query

    if (!error && data) {
      const normalized = data.map((o: any) => ({
        ...o,
        client: Array.isArray(o.clients) ? o.clients[0] || null : o.clients || null,
      }))
      setOrders(normalized)
    }
    
    setRefreshing(false)
  }

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase().trim()
    return orders.filter((o) => {
      return !q || 
        o.order_code?.toLowerCase().includes(q) ||
        String(o.order_number).includes(q) ||
        o.client?.name?.toLowerCase().includes(q)
    })
  }, [orders, search])

  const confirmedTotal = orders
    .filter(o => o.status === 'confirmed')
    .reduce((acc, o) => acc + Number(o.total_amount || 0), 0)

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-slate-900">Pedidos</h1>
            {role === 'admin' && (
              <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck size={10} /> Admin
              </span>
            )}
          </div>
          <p className="text-sm text-emerald-600 font-black uppercase tracking-widest flex items-center gap-1.5 mt-1">
            <PackageCheck size={16} /> {role === 'admin' ? 'Ventas totales confirmadas' : 'Mis ventas confirmadas'}: ${confirmedTotal.toLocaleString('es-AR')}
          </p>
        </div>
        <button
          onClick={refreshOrders}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </section>

      <section className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Número de pedido o cliente..."
          className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition shadow-sm"
        />
      </section>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white p-12 rounded-[2rem] border border-dashed border-slate-300 text-center">
            <ClipboardList size={40} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold">No se encontraron pedidos.</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <article 
              key={order.id} 
              className={`bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm hover:shadow-md transition relative overflow-hidden ${
                order.status === 'cancelled' ? 'opacity-60 grayscale' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                    order.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <ClipboardList size={32} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-black text-slate-950 text-xl tracking-tight">
                        {order.order_code || `PED-${order.order_number}`}
                      </h3>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="font-bold text-slate-600 truncate text-base flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      {order.client?.name || 'Cliente sin nombre'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center border-t sm:border-t-0 pt-5 sm:pt-0">
                  <div className="sm:text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest sm:mb-1">Facturación</p>
                    <p className="text-2xl font-black text-slate-950 leading-none tracking-tight">
                      ${Number(order.total_amount || 0).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <Link 
                    href={`/vendedor/pedidos/${order.id}`}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3.5 rounded-2xl text-xs font-black hover:bg-blue-500 transition shadow-lg shadow-blue-900/20"
                  >
                    Ver Detalles
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 w-fit px-3 py-1.5 rounded-lg">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <CalendarDays size={14} />
                  {new Date(order.order_date).toLocaleDateString()}
                </div>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <span>ID Sistema: {order.order_number}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock3 },
    confirmed: { label: 'Confirmado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    cancelled: { label: 'Anulado', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  }
  const config = configs[status] || configs.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${config.color}`}>
      <config.icon size={10} />
      {config.label}
    </span>
  )
}
