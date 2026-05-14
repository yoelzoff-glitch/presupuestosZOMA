'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Search,
  Plus,
  Pencil,
  Users,
  Building2,
  IdCard,
  RefreshCw,
  Loader2,
  UserPlus,
  Filter,
  UserCheck,
  Lock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Cliente = {
  id: string
  cuit: string | null
  name: string
  address: string | null
  email: string | null
  phone: string | null
  active?: boolean | null
  created_at?: string
  seller_id?: string | null
  client_type?: 'consumidor_final' | 'distribuidor' | null
  seller?: {
    full_name: string
  } | null
}

type PerfilVendedor = {
  id: string
  full_name: string
}

type Props = {
  clientesIniciales: Cliente[]
  vendedoresIniciales: PerfilVendedor[]
  idEmpresa: string
  tipoPlan: string
}

export default function ClientesClient({
  clientesIniciales,
  vendedoresIniciales,
  idEmpresa,
  tipoPlan,
}: Props) {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciales)
  const [vendedores] = useState<PerfilVendedor[]>(vendedoresIniciales)
  const [busqueda, setBusqueda] = useState('')
  const [filtroVendedor, setFiltroVendedor] = useState<string>('all')
  const [actualizando, setActualizando] = useState(false)

  async function actualizarClientes() {
    setActualizando(true)
    const { data, error } = await supabase
      .from('clients')
      .select(`id, cuit, name, address, email, phone, active, created_at, seller_id, client_type, seller:users_profiles!seller_id(full_name)`)
      .eq('company_id', idEmpresa)
      .order('created_at', { ascending: false })

    if (!error) setClientes((data as any) || [])
    setActualizando(false)
  }

  const clientesFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return clientes.filter((c) => {
      const coincideBusqueda = !q || c.name?.toLowerCase().includes(q) || c.cuit?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
      const coincideVendedor = filtroVendedor === 'all' || c.seller_id === filtroVendedor
      return coincideBusqueda && coincideVendedor
    })
  }, [clientes, busqueda, filtroVendedor])

  const clientesActivos = clientes.filter((c) => c.active !== false)
  const clientesInactivos = clientes.filter((c) => c.active === false)
  const cuitsUnicos = new Set(clientes.map((c) => c.cuit?.trim()).filter(Boolean)).size

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
        <TarjetaEstado titulo="Total" valor={clientes.length} icon={Users} tono="blue" />
        <TarjetaEstado titulo="Activos" valor={clientesActivos.length} icon={Building2} tono="green" />
        <TarjetaEstado titulo="Inactivos" valor={clientesInactivos.length} icon={UserPlus} tono="slate" />
        <TarjetaEstado titulo="CUIT únicos" valor={cuitsUnicos} icon={IdCard} tono="blue" />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="space-y-4 border-b border-slate-200 p-5 bg-slate-50/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-xl font-black text-slate-950">Listado Maestro</h2><p className="text-sm text-slate-500">Buscá por nombre, CUIT/DNI o mail.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente..." className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:w-80" />
              </div>
              <button type="button" onClick={actualizarClientes} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><RefreshCw size={17} className={actualizando ? 'animate-spin' : ''} /> Actualizar</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><Filter size={14} /> Filtrar por Vendedor:</div>
            <div className="relative">
              <UserCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
              <select
                value={filtroVendedor}
                disabled={tipoPlan === 'base'}
                onChange={(e) => setFiltroVendedor(e.target.value)}
                className={`rounded-xl border-2 py-2 pl-9 pr-4 text-sm font-bold text-slate-700 outline-none transition ${
                  tipoPlan === 'base'
                    ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                    : 'border-slate-200 bg-white focus:border-blue-500'
                }`}
              >
                <option value="all">Todos los vendedores</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.full_name}</option>)}
              </select>
              {tipoPlan === 'base' && (
                <div className="absolute -top-2.5 -right-2 flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white shadow-lg ring-2 ring-white">
                  <Lock size={8} /> PRO
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
              <tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">CUIT / DNI</th><th className="px-6 py-4">Vendedor</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Acción</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientesFiltrados.map(c => (
                <tr key={c.id} className="hover:bg-blue-50/30 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-slate-900">{c.name}</p>
                      <EtiquetaTipoCliente tipo={c.client_type} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.email || c.phone || 'Sin contacto'}</p>
                  </td>
                  <td className="px-6 py-4"><EtiquetaCuit cuit={c.cuit} /></td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600">{c.seller?.full_name || 'Sin asignar'}</td>
                  <td className="px-6 py-4"><EtiquetaEstado activo={c.active !== false} /></td>
                  <td className="px-6 py-4 text-right"><BotonEditar id={c.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function TarjetaEstado({ titulo, valor, icon: Icon, tono }: { titulo: string; valor: number; icon: LucideIcon; tono: string }) {
  const estilos: Record<string, string> = { blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', slate: 'bg-slate-100 text-slate-700' }
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${estilos[tono]}`}><Icon size={22} /></div>
        <div><p className="text-xs font-bold text-slate-400">{titulo}</p><p className="text-2xl font-black text-slate-950">{valor}</p></div>
      </div>
    </div>
  )
}

function EtiquetaCuit({ cuit }: { cuit: string | null }) {
  return <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${cuit ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}><IdCard size={14} />{cuit || 'Cons. Final'}</div>
}

function EtiquetaEstado({ activo }: { activo: boolean }) {
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase ${activo ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{activo ? 'Activo' : 'Inactivo'}</span>
}

function EtiquetaTipoCliente({ tipo }: { tipo: string | null | undefined }) {
  if (tipo === 'distribuidor') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-blue-600 text-[9px] font-black uppercase tracking-tighter text-white shadow-sm">
        DIST
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 text-[9px] font-black uppercase tracking-tighter text-slate-500">
      C.F.
    </span>
  )
}

function BotonEditar({ id }: { id: string }) {
  return <Link href={`/clientes/${id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"><Pencil size={14} /> Editar</Link>
}
