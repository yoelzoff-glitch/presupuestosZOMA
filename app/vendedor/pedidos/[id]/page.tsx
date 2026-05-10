'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileText,
  Loader2,
  Package,
  User,
  XCircle,
  Zap,
} from 'lucide-react'

type Order = {
  id: string
  order_number: number
  order_code: string | null
  order_date: string | null
  status: string
  total_amount: number | null
  clients?: {
    name: string
    cuit: string
    address: string | null
  } | null
}

type OrderItem = {
  id: string
  product_name: string
  product_code: string | null
  quantity: number
  unit_price: number | null
  discount_str: string | null
}

export default function VendedorPedidoDetalle() {
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orderId) loadOrder()
  }, [orderId])

  async function loadOrder() {
    setLoading(true)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`id, order_number, order_code, order_date, status, total_amount, clients ( name, cuit, address )`)
      .eq('id', orderId)
      .single()

    if (orderError || !orderData) {
      toast.error('No se pudo cargar el pedido.')
      setLoading(false); return
    }

    setOrder({ ...orderData, clients: Array.isArray(orderData.clients) ? orderData.clients[0] : orderData.clients } as any)

    const { data: itemsData } = await supabase
      .from('order_items')
      .select(`id, product_name, product_code, quantity, unit_price, discount_str`)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    setItems(itemsData || [])
    setLoading(false)
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" size={40} /></div>
  if (!order) return <div className="p-20 text-center font-black">Pedido no encontrado</div>

  const orderLabel = order.order_code || `PED-${order.order_number}`

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <section className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <Link href="/vendedor/pedidos" className="inline-flex items-center gap-2 text-blue-400 text-xs font-black uppercase tracking-widest mb-4 hover:text-white transition">
            <ArrowLeft size={16} /> Volver al listado
          </Link>
          <h1 className="text-3xl font-black tracking-tight">Pedido {orderLabel}</h1>
        </div>
        <StatusBadge status={order.status} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
           <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><User size={24} /></div>
           <div className="min-w-0">
             <p className="text-[10px] font-black uppercase text-slate-400">Cliente</p>
             <p className="font-black text-slate-900 truncate">{order.clients?.name}</p>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
           <div className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0"><CalendarDays size={24} /></div>
           <div>
             <p className="text-[10px] font-black uppercase text-slate-400">Fecha</p>
             <p className="font-black text-slate-900">{new Date(order.order_date!).toLocaleDateString()}</p>
           </div>
        </div>
        <div className="bg-emerald-600 p-6 rounded-3xl shadow-lg shadow-emerald-900/10 text-white flex items-center gap-4">
           <div className="h-12 w-12 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0"><DollarSign size={24} /></div>
           <div>
             <p className="text-[10px] font-black uppercase text-emerald-200">Monto Total</p>
             <p className="text-2xl font-black">${order.total_amount?.toLocaleString('es-AR')}</p>
           </div>
        </div>
      </section>

      <section className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <Package size={18} className="text-blue-600" />
          <h3 className="font-black text-slate-900">Detalle del Pedido</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4 text-center">Cant</th>
                <th className="px-6 py-4 text-right">Unitario</th>
                <th className="px-6 py-4 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id} className="text-sm">
                  <td className="px-6 py-4">
                    <p className="font-black text-slate-900">{item.product_name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.product_code || 'S/C'}</p>
                    {item.discount_str && <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded inline-flex items-center gap-1 mt-1"><Zap size={8} /> Desc: {item.discount_str}</span>}
                  </td>
                  <td className="px-6 py-4 text-center font-bold">{item.quantity}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-500">${item.unit_price?.toLocaleString('es-AR')}</td>
                  <td className="px-6 py-4 text-right font-black text-blue-700">${((item.quantity || 0) * (item.unit_price || 0)).toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    pending: { label: 'En espera', icon: Clock3, className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    confirmed: { label: 'Confirmado', icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    cancelled: { label: 'Anulado', icon: XCircle, className: 'bg-red-500/10 text-red-500 border-red-500/20' },
  }
  const config = configs[status] || configs.pending
  return (
    <div className={`inline-flex items-center gap-2 rounded-2xl border px-6 py-3 text-xs font-black uppercase tracking-widest ${config.className}`}>
      <config.icon size={16} /> {config.label}
    </div>
  )
}
