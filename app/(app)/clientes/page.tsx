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
} from 'lucide-react'

type Client = {
  id: string
  cuit: string
  name: string
  address: string | null
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
  const [myId, setMyId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    setLoading(true)
    
    // 1. Obtener usuario actual y su perfil
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setErrorMsg('No se pudo autenticar al usuario.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id, role, id')
      .eq('id', userData.user.id)
      .single()

    if (!profile?.company_id) {
      setErrorMsg('No se encontró el perfil del usuario.')
      setLoading(false)
      return
    }

    setMyId(profile.id)
    setRole(profile.role)

    // 2. Cargar todos los vendedores de la empresa para el filtro
    const { data: sellersData } = await supabase
      .from('users_profiles')
      .select('id, full_name')
      .eq('company_id', profile.company_id)
      .order('full_name')

    setSellers(sellersData || [])

    // 3. Establecer filtro inicial: si es vendedor, se pone a sí mismo
    if (profile.role === 'vendedor') {
      setSellerFilter(profile.id)
    } else {
      setSellerFilter('all')
    }

    // 4. Cargar clientes
    await loadClients(profile.company_id)
  }

  async function loadClients(companyId?: string) {
    let cid = companyId
    
    if (!cid) {
      const { data: userData } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('company_id')
        .eq('id', userData.user?.id)
        .single()
      cid = profile?.company_id
    }

    if (!cid) return

    const { data, error } = await supabase
      .from('clients')
      .select(`
        id, 
        cuit, 
        name, 
        address, 
        active, 
        created_at, 
        seller_id,
        seller:users_profiles!seller_id(full_name)
      `)
      .eq('company_id', cid)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMsg('Error al cargar clientes.')
    } else {
      setClients((data as any) || [])
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
      const matchesSearch = !q || 
        client.name?.toLowerCase().includes(q) ||
        client.cuit?.toLowerCase().includes(q) ||
        client.address?.toLowerCase().includes(q)

      const matchesSeller = sellerFilter === 'all' || client.seller_id === sellerFilter

      return matchesSearch && matchesSeller
    })
  }, [clients, search, sellerFilter])

  const activeClients = clients.filter((client) => client.active !== false)
  const inactiveClients = clients.filter((client) => client.active === false)
  const uniqueCuits = new Set(
    clients
      .map((client) => client.cuit?.trim())
      .filter(Boolean)
  ).size

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <Users size={14} />
              Clientes
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Gestión de clientes
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Alta, consulta y edición de clientes. Ahora podés ver los clientes de tus compañeros en caso de ser necesario.
            </p>
          </div>

          <Link
            href="/clientes/nuevo"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
          >
            <Plus size={18} />
            Nuevo cliente
          </Link>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total clientes"
          value={clients.length}
          icon={Users}
          loading={loading}
          tone="blue"
        />

        <StatCard
          title="Clientes activos"
          value={activeClients.length}
          icon={Building2}
          loading={loading}
          tone="green"
        />

        <StatCard
          title="Inactivos"
          value={inactiveClients.length}
          icon={UserPlus}
          loading={loading}
          tone="slate"
        />

        <StatCard
          title="CUIT únicos"
          value={uniqueCuits}
          icon={IdCard}
          loading={loading}
          tone="blue"
        />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-slate-200 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Listado de clientes
              </h2>

              <p className="text-sm text-slate-500">
                Buscá por nombre, CUIT o filtrá por vendedor.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:w-80"
                />
              </div>

              <button
                type="button"
                onClick={refreshClients}
                disabled={loading || refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={loading || refreshing ? 'animate-spin' : ''}
                />
                Actualizar
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
              <Filter size={14} />
              Filtrar por Vendedor:
            </div>

            <div className="relative">
              <UserCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">Todos los vendedores</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.id === myId ? '(Yo)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {search && (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              Resultado: {filteredClients.length} cliente
              {filteredClients.length === 1 ? '' : 's'} encontrado
              {filteredClients.length === 1 ? '' : 's'}.
            </div>
          )}
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredClients.length === 0 ? (
          <EmptyState hasSearch={Boolean(search.trim())} />
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto pb-4 custom-scrollbar">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Vendedor Asignado</TableHead>
                    <TableHead>Alta</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead align="right">Acción</TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      className="transition hover:bg-blue-50/40"
                    >
                      <td className="px-5 py-4">
                        <ClientIdentity client={client} />
                      </td>

                      <td className="px-5 py-4">
                        <CuitBadge cuit={client.cuit} />
                      </td>

                      <td className="px-5 py-4">
                        <AddressText address={client.address} />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-blue-50 text-[10px] font-black text-blue-600 border border-blue-200">
                            {client.seller?.full_name?.charAt(0) || 'A'}
                          </div>
                          {client.seller?.full_name || 'Sin asignar'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <DateText date={client.created_at} />
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge active={client.active !== false} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <EditButton id={client.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {filteredClients.map((client) => (
                <ClientMobileCard key={client.id} client={client} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function ClientMobileCard({ client }: { client: Client }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <ClientIdentity client={client} />
        <StatusBadge active={client.active !== false} />
      </div>

      <div className="mt-4 space-y-3">
        <CuitBadge cuit={client.cuit} />
        <AddressText address={client.address} />
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">
          <span className="text-slate-400 uppercase tracking-widest text-[9px]">Vendedor:</span>
          {client.seller?.full_name || 'Sin asignar'}
        </div>
        <DateText date={client.created_at} />
      </div>

      <div className="mt-4">
        <EditButton id={client.id} fullWidth />
      </div>
    </article>
  )
}

function ClientIdentity({ client }: { client: Client }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
        {client.name?.charAt(0)?.toUpperCase() || 'C'}
      </div>

      <div className="min-w-0">
        <p className="truncate font-black text-slate-950">{client.name}</p>
        <p className="text-xs font-semibold text-slate-400">
          Ficha de cliente
        </p>
      </div>
    </div>
  )
}

function CuitBadge({ cuit }: { cuit: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
      <IdCard size={15} />
      {cuit || '-'}
    </div>
  )
}

function AddressText({ address }: { address: string | null }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
      <MapPin size={16} className="shrink-0 text-slate-400" />
      <span className="line-clamp-2">{address || 'Sin dirección'}</span>
    </div>
  )
}

function DateText({ date }: { date?: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
      <CalendarDays size={15} />
      {date ? new Date(date).toLocaleDateString('es-AR') : '-'}
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  if (!active) {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
        Inactivo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
      Activo
    </span>
  )
}

function EditButton({
  id,
  fullWidth = false,
}: {
  id: string
  fullWidth?: boolean
}) {
  return (
    <Link
      href={`/clientes/${id}`}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 ${
        fullWidth ? 'w-full' : ''
      }`}
    >
      <Pencil size={15} />
      Editar
    </Link>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  tone,
}: {
  title: string
  value: number
  icon: any
  loading: boolean
  tone: 'blue' | 'green' | 'slate'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles[tone]}`}
        >
          <Icon size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-500">
            {title}
          </p>

          <h2 className="truncate text-2xl font-black text-slate-950">
            {loading ? '...' : value}
          </h2>
        </div>
      </div>
    </div>
  )
}

function TableHead({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
        <Loader2 size={26} className="animate-spin" />
      </div>

      <h3 className="text-lg font-black text-slate-900">
        Cargando clientes
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Estamos consultando la información registrada.
      </p>
    </div>
  )
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
        <Users size={26} />
      </div>

      <h3 className="text-lg font-black text-slate-900">
        No hay clientes para mostrar
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {hasSearch
          ? 'Probá cambiar la búsqueda o el filtro de vendedor.'
          : 'Creá un cliente nuevo para empezar a trabajar.'}
      </p>

      {!hasSearch && (
        <Link
          href="/clientes/nuevo"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
        >
          <Plus size={18} />
          Nuevo cliente
        </Link>
      )}
    </div>
  )
}