'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Search,
  Plus,
  Users,
  IdCard,
  MapPin,
  RefreshCw,
  Loader2,
  CalendarDays,
  Mail,
  Phone,
  ArrowRight,
  ShieldCheck
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
}

export default function VendedorClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    
    setRole(profile?.role || 'vendedor')
    const isAdmin = profile?.role === 'admin'

    let query = supabase
      .from('clients')
      .select(`
        id, cuit, name, address, email, phone, active, created_at, seller_id
      `)
      .order('name', { ascending: true })

    // Solo filtrar si NO es admin
    if (!isAdmin) {
      query = query.eq('seller_id', userData.user.id)
    }

    const { data, error } = await query

    if (!error && data) {
      setClients(data as any)
    }
    
    setLoading(false)
  }

  async function refreshClients() {
    setRefreshing(true)
    await loadClients()
    setRefreshing(false)
  }

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim()
    return clients.filter((client) => {
      return !q || 
        client.name?.toLowerCase().includes(q) ||
        client.cuit?.toLowerCase().includes(q) ||
        client.email?.toLowerCase().includes(q)
    })
  }, [clients, search])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <Loader2 size={40} className="animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 font-bold">Cargando clientes...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-slate-900">Clientes</h1>
            {role === 'admin' && (
              <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck size={10} /> Admin
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 font-medium">
            {role === 'admin' ? 'Visualizando todos los clientes del sistema.' : 'Gestiona tu cartera de contactos y prospectos.'}
          </p>
        </div>
        <Link
          href="/vendedor/clientes/nuevo"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition"
        >
          <Plus size={18} />
          Nuevo Cliente
        </Link>
      </section>

      {/* Buscador */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, CUIT o mail..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition shadow-sm"
          />
        </div>
        <button
          onClick={refreshClients}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </section>

      {/* Listado */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredClients.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-[2rem] border border-dashed border-slate-300 text-center">
            <Users size={40} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold">No se encontraron clientes.</p>
          </div>
        ) : (
          filteredClients.map((client) => (
            <article key={client.id} className="bg-white rounded-[2rem] border border-slate-200 p-5 shadow-sm hover:shadow-md transition group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-inner">
                    {client.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 truncate pr-2">{client.name}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <IdCard size={12} />
                      {client.cuit || 'S/D'}
                    </div>
                  </div>
                </div>
                <div className={`h-2.5 w-2.5 rounded-full ${client.active !== false ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
              </div>

              <div className="space-y-2.5 mb-5">
                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600">
                  <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Mail size={14} /></div>
                  <span className="truncate">{client.email || 'Sin email'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600">
                  <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Phone size={14} /></div>
                  <span>{client.phone || 'Sin teléfono'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-500">
                  <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0"><MapPin size={14} /></div>
                  <span className="line-clamp-1">{client.address || 'Sin dirección'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-50 px-2 py-1 rounded-md">
                  <CalendarDays size={12} />
                  Alta: {client.created_at ? new Date(client.created_at).toLocaleDateString() : '-'}
                </div>
                <Link 
                  href={`/vendedor/clientes/${client.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-700 transition"
                >
                  Ver Ficha
                  <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
