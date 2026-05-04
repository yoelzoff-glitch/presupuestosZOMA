'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Search,
  Plus,
  Pencil,
  Users,
  Building2,
  IdCard,
  MapPin,
  RefreshCw,
} from 'lucide-react'

type Client = {
  id: string
  cuit: string
  name: string
  address: string | null
  created_at?: string
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    setLoading(true)

    const { data: user } = await supabase.auth.getUser()

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.user?.id)
      .single()

    const company_id = profile?.company_id

    if (!company_id) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setClients(data)
    }

    setLoading(false)
  }

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim()

    if (!q) return clients

    return clients.filter((client) => {
      return (
        client.name?.toLowerCase().includes(q) ||
        client.cuit?.toLowerCase().includes(q) ||
        client.address?.toLowerCase().includes(q)
      )
    })
  }, [clients, search])

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
              Alta, consulta y edición de clientes para presupuestos y cuenta corriente.
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

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Users size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">Total clientes</p>
              <h2 className="text-2xl font-black text-slate-950">
                {loading ? '...' : clients.length}
              </h2>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">Activos</p>
              <h2 className="text-2xl font-black text-slate-950">
                {loading ? '...' : clients.length}
              </h2>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <IdCard size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">CUIT únicos</p>
              <h2 className="text-2xl font-black text-slate-950">
                {loading ? '...' : new Set(clients.map((c) => c.cuit)).size}
              </h2>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              Listado de clientes
            </h2>
            <p className="text-sm text-slate-500">
              Buscá por nombre, CUIT o dirección.
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
              onClick={loadClients}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={17} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm font-bold text-slate-500">
              Cargando clientes...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                <Users size={26} />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                No hay clientes para mostrar
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Creá un cliente nuevo o cambiá la búsqueda.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Cliente
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    CUIT
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Dirección
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((c) => (
                  <tr key={c.id} className="transition hover:bg-blue-50/40">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                          {c.name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>

                        <div>
                          <p className="font-black text-slate-950">{c.name}</p>
                          <p className="text-xs font-semibold text-slate-400">
                            ID cliente
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                        <IdCard size={15} />
                        {c.cuit}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-slate-400" />
                        {c.address || 'Sin dirección'}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Pencil size={15} />
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}