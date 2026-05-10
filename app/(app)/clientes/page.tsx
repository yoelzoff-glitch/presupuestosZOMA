'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Search,
  Plus,
  Pencil,
  Users,
  Building2,
  IdCard,
  MapPin,
  RefreshCw,
  Loader2,
  UserPlus,
  CalendarDays,
  Filter,
  UserCheck,
  Mail,
  Phone,
  Lock,
} from 'lucide-react'

type Client = {
  id: string
  cuit: string | null
  name: string
  address: string | null
  email: string | null
  phone: string | null
  active?: boolean | null
  created_at?: string
  seller_id?: string | null
  seller?: {
    full_name: string
  } | null
}

type SellerProfile = {
  id: string
  full_name: string
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [sellers, setSellers] = useState<SellerProfile[]>([])
  const [search, setSearch] = useState('')
  const [sellerFilter, setSellerFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [planType, setPlanType] = useState('base')

  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setErrorMsg('No se pudo autenticar al usuario.'); setLoading(false); return
    }

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id, company:companies(plan_type)')
      .eq('id', userData.user.id)
      .single()
    
    if (!profile?.company_id) {
      setErrorMsg('No se encontró el perfil del usuario.'); setLoading(false); return
    }

    setPlanType((profile.company as any)?.plan_type || 'base')

    const companyId = profile.company_id

    const { data: sellersData } = await supabase.from('users_profiles').select('id, full_name').eq('company_id', companyId).order('full_name')
    setSellers(sellersData || [])

    await loadClients(companyId)
  }

  async function loadClients(companyId?: string) {
    let cid = companyId
    if (!cid) {
      const { data: userData } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('users_profiles').select('company_id').eq('id', userData.user?.id).single()
      cid = profile?.company_id
    }
    if (!cid) return

    const { data, error } = await supabase
      .from('clients')
      .select(`id, cuit, name, address, email, phone, active, created_at, seller_id, seller:users_profiles!seller_id(full_name)`)
      .eq('company_id', cid)
      .order('created_at', { ascending: false })

    if (error) setErrorMsg('Error al cargar clientes.')
    else setClients((data as any) || [])
    setLoading(false)
  }

  async function refreshClients() {
    setRefreshing(true); await loadClients(); setRefreshing(false)
  }

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim()
    return clients.filter((client) => {
      const matchesSearch = !q || client.name?.toLowerCase().includes(q) || client.cuit?.toLowerCase().includes(q) || client.email?.toLowerCase().includes(q)
      const matchesSeller = sellerFilter === 'all' || client.seller_id === sellerFilter
      return matchesSearch && matchesSeller
    })
  }, [clients, search, sellerFilter])

  const activeClients = clients.filter((client) => client.active !== false)
  const inactiveClients = clients.filter((client) => client.active === false)
  const uniqueCuits = new Set(clients.map((client) => client.cuit?.trim()).filter(Boolean)).size

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <Users size={14} /> Clientes
            </div>
            <h1 className="text-3xl font-black tracking-tight">Base de clientes global</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Consulta y gestión de toda la cartera comercial de la empresa.</p>
          </div>
          <Link href="/clientes/nuevo" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 active:scale-95"><Plus size={18} /> Nuevo cliente</Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={clients.length} icon={Users} loading={loading} tone="blue" />
        <StatCard title="Activos" value={activeClients.length} icon={Building2} loading={loading} tone="green" />
        <StatCard title="Inactivos" value={inactiveClients.length} icon={UserPlus} loading={loading} tone="slate" />
        <StatCard title="CUIT únicos" value={uniqueCuits} icon={IdCard} loading={loading} tone="blue" />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="space-y-4 border-b border-slate-200 p-5 bg-slate-50/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-xl font-black text-slate-950">Listado Maestro</h2><p className="text-sm text-slate-500">Buscá por nombre, CUIT/DNI o mail.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:w-80" />
              </div>
              <button type="button" onClick={refreshClients} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} /> Actualizar</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><Filter size={14} /> Filtrar por Vendedor:</div>
            <div className="relative">
              <UserCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
              <select 
                value={sellerFilter} 
                disabled={planType === 'base'}
                onChange={(e) => setSellerFilter(e.target.value)} 
                className={`rounded-xl border-2 py-2 pl-9 pr-4 text-sm font-bold text-slate-700 outline-none transition ${
                  planType === 'base'
                    ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                    : 'border-slate-200 bg-white focus:border-blue-500'
                }`}
              >
                <option value="all">Todos los vendedores</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>

              {planType === 'base' && (
                <div className="absolute -top-2.5 -right-2 flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white shadow-lg ring-2 ring-white">
                  <Lock size={8} /> PRO
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? <LoadingState /> : (
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                 <tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">CUIT / DNI</th><th className="px-6 py-4">Vendedor</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Acción</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {filteredClients.map(client => (
                   <tr key={client.id} className="hover:bg-blue-50/30 transition">
                     <td className="px-6 py-4">
                       <p className="font-black text-slate-900">{client.name}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{client.email || client.phone || 'Sin contacto'}</p>
                     </td>
                     <td className="px-6 py-4"><CuitBadge cuit={client.cuit} /></td>
                     <td className="px-6 py-4 text-xs font-bold text-slate-600">{client.seller?.full_name || 'Sin asignar'}</td>
                     <td className="px-6 py-4"><StatusBadge active={client.active !== false} /></td>
                     <td className="px-6 py-4 text-right"><EditButton id={client.id} /></td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, loading, tone }: any) {
  const styles: any = { blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', slate: 'bg-slate-100 text-slate-700' }
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${styles[tone]}`}><Icon size={22} /></div>
        <div><p className="text-xs font-bold text-slate-400">{title}</p><p className="text-2xl font-black text-slate-950">{loading ? '...' : value}</p></div>
      </div>
    </div>
  )
}

function CuitBadge({ cuit }: { cuit: string | null }) {
  return <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${cuit ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}><IdCard size={14} />{cuit || 'Cons. Final'}</div>
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{active ? 'Activo' : 'Inactivo'}</span>
}

function EditButton({ id }: { id: string }) {
  return <Link href={`/clientes/${id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"><Pencil size={14} /> Editar</Link>
}

function LoadingState() {
  return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-4" size={32} /><p className="font-black text-slate-900">Cargando base de clientes...</p></div>
}