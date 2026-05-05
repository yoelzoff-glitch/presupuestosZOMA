'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Users,
  Plus,
  Loader2,
  X,
  Lock,
  User,
  UserCheck,
  UserX,
  ShieldCheck,
  Mail,
  RefreshCw,
} from 'lucide-react'

type CustomerUser = {
  id: string
  name: string
  email: string
  active: boolean
}

export default function ClientesConfigPage() {
  const [customers, setCustomers] = useState<CustomerUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
  })

  useEffect(() => {
    loadCustomers()
  }, [])

  async function getCompanyId() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', data.user.id)
      .single()

    return profile?.company_id || null
  }

  async function loadCustomers() {
    setLoading(true)

    const companyId = await getCompanyId()

    const { data } = await supabase
      .from('customer_users')
      .select('id, name, email, active')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    setCustomers(data || [])
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.name || !form.username || !form.password) return

    setSaving(true)

    const companyId = await getCompanyId()

    const res = await fetch('/api/customer-users', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name,
        username: form.username,
        password: form.password,
        companyId,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.error || 'Error al crear usuario')
      setSaving(false)
      return
    }

    setForm({ name: '', username: '', password: '' })
    setShowModal(false)
    await loadCustomers()
    setSaving(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase
      .from('customer_users')
      .update({ active: !current })
      .eq('id', id)

    loadCustomers()
  }

  const activeCustomers = customers.filter((c) => c.active).length
  const inactiveCustomers = customers.filter((c) => !c.active).length

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-200">
              <ShieldCheck size={14} />
              Accesos clientes
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Gestión de clientes con acceso
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Creá usuarios para que tus clientes ingresen al portal, vean precios
              actualizados y realicen pedidos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadCustomers}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-60"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:-translate-y-0.5 hover:bg-blue-500"
            >
              <Plus size={18} />
              Nuevo cliente
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Usuarios creados" value={customers.length} icon={Users} tone="blue" />
        <SummaryCard title="Activos" value={activeCustomers} icon={UserCheck} tone="green" />
        <SummaryCard title="Inactivos" value={inactiveCustomers} icon={UserX} tone="slate" />
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white p-5">
          <h2 className="text-xl font-black text-slate-950">
            Usuarios clientes
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Administrá quiénes pueden entrar al portal de pedidos.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <Loader2 className="mb-3 animate-spin text-blue-600" size={30} />
            <p className="font-bold text-slate-600">Cargando clientes...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
              <Users size={30} />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              No hay usuarios clientes creados
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Creá el primer acceso para un cliente.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-hidden">
            <table className="w-full table-fixed">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Cliente
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Usuario
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-500">
                    Estado
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="transition hover:bg-blue-50/40">
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                          <Users size={20} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950">
                            {c.name}
                          </p>
                          <p className="text-xs font-semibold text-slate-400">
                            Usuario cliente
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                        <Mail size={14} />
                        <span className="truncate">{c.email}</span>
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${
                          c.active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.active ? <UserCheck size={14} /> : <UserX size={14} />}
                        {c.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => toggleActive(c.id, c.active)}
                        className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                          c.active
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {c.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-white/90 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

            <div className="relative z-10 p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Nuevo cliente
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Creá acceso con usuario y contraseña
                  </p>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <InputBox
                  icon={User}
                  placeholder="Nombre del cliente"
                  value={form.name}
                  onChange={(value) => setForm({ ...form, name: value })}
                />

                <InputBox
                  icon={User}
                  placeholder="Usuario (ej: cliente1)"
                  value={form.username}
                  onChange={(value) => setForm({ ...form, username: value })}
                />

                <InputBox
                  icon={Lock}
                  type="password"
                  placeholder="Contraseña"
                  value={form.password}
                  onChange={(value) => setForm({ ...form, password: value })}
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={saving}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 size={17} className="animate-spin" />}
                {saving ? 'Creando...' : 'Crear cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string
  value: number
  icon: typeof Users
  tone: 'blue' | 'green' | 'slate'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles[tone]}`}
        >
          <Icon size={23} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-500">{title}</p>
          <h3 className="text-2xl font-black text-slate-950">{value}</h3>
        </div>
      </div>
    </div>
  )
}

function InputBox({
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  icon: typeof User
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <div className="relative">
      <Icon
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        size={16}
      />

      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  )
}