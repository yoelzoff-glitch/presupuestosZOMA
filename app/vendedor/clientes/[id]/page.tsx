'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  User,
  Save,
  Loader2,
  Building2,
  Mail,
  Phone,
  MapPin,
  IdCard,
  FileText,
  ClipboardList,
  PlusCircle,
  TrendingUp
} from 'lucide-react'

export default function VendedorClienteDetalle() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [cuit, setCuit] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [stats, setStats] = useState({ budgets: 0, orders: 0, totalAmount: 0 })

  useEffect(() => {
    if (id) loadClient()
  }, [id])

  async function loadClient() {
    setInitialLoading(true)
    const { data: client, error } = await supabase.from('clients').select('*').eq('id', id).single()

    if (error || !client) {
      toast.error('Error al cargar cliente'); setInitialLoading(false); return
    }

    setName(client.name || '')
    setCuit(client.cuit || '')
    setAddress(client.address || '')
    setEmail(client.email || '')
    setPhone(client.phone || '')

    // Cargar estadísticas rápidas del cliente
    const [budgetsRes, ordersRes] = await Promise.all([
      supabase.from('budgets').select('id', { count: 'exact' }).eq('client_id', id),
      supabase.from('orders').select('total_amount').eq('client_id', id).eq('status', 'confirmed')
    ])

    const confirmedTotal = (ordersRes.data || []).reduce((acc, o) => acc + (o.total_amount || 0), 0)
    setStats({
      budgets: budgetsRes.count || 0,
      orders: (ordersRes.data || []).length,
      totalAmount: confirmedTotal
    })

    setInitialLoading(false)
  }

  async function handleUpdate() {
    if (!name.trim()) { toast.error('Nombre obligatorio'); return }
    setLoading(true)
    const { error } = await supabase.from('clients').update({ name, cuit, email, phone, address }).eq('id', id)
    setLoading(false)
    if (error) toast.error(error.message)
    else toast.success('Cliente actualizado')
  }

  if (initialLoading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" size={40} /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <section className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <Link href="/vendedor/clientes" className="inline-flex items-center gap-2 text-blue-400 text-xs font-black uppercase tracking-widest mb-4 hover:text-white transition">
            <ArrowLeft size={16} /> Volver al listado
          </Link>
          <h1 className="text-3xl font-black tracking-tight">{name}</h1>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest flex items-center gap-2"><IdCard size={14} /> CUIT: {cuit || 'S/D'}</p>
        </div>
        <Link 
          href={`/vendedor/presupuestos/nuevo?client=${id}`}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-2xl font-black text-xs transition shadow-lg shadow-blue-900/20 flex items-center gap-2"
        >
          <PlusCircle size={18} /> Nuevo Presupuesto
        </Link>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatItem icon={FileText} label="Presupuestos" value={stats.budgets} color="text-blue-600" />
        <StatItem icon={ClipboardList} label="Pedidos" value={stats.orders} color="text-emerald-600" />
        <StatItem icon={TrendingUp} label="Facturación" value={`$${stats.totalAmount.toLocaleString('es-AR')}`} color="text-purple-600" />
      </section>

      <section className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
        <h3 className="font-black text-slate-900 mb-8 border-b pb-4">Información de Contacto</h3>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputGroup label="Nombre / Razón Social" value={name} onChange={setName} icon={Building2} />
            <InputGroup label="CUIT / DNI" value={cuit} onChange={setCuit} icon={IdCard} />
            <InputGroup label="Email" value={email} onChange={setEmail} icon={Mail} />
            <InputGroup label="Teléfono / WhatsApp" value={phone} onChange={setPhone} icon={Phone} />
          </div>
          <InputGroup label="Dirección Completa" value={address} onChange={setAddress} icon={MapPin} />
          
          <div className="pt-6 border-t">
            <button 
              onClick={handleUpdate}
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black transition flex items-center justify-center gap-2 shadow-xl"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatItem({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center">
      <div className={`h-12 w-12 rounded-2xl bg-slate-50 ${color} flex items-center justify-center mx-auto mb-3 shadow-inner`}>
        <Icon size={24} />
      </div>
      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
    </div>
  )
}

function InputGroup({ label, value, onChange, icon: Icon }: any) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <div className="relative">
        <Icon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition shadow-inner"
        />
      </div>
    </div>
  )
}
