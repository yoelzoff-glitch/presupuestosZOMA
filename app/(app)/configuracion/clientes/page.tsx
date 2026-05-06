'use client'

import { useEffect, useMemo, useState } from 'react'
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
  Building2,
  IdCard,
  Link2,
  Search,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Client = {
  id: string
  name: string
  cuit: string
  active: boolean | null
}

type CustomerUser = {
  id: string
  name: string
  email: string
  active: boolean
  client_id: string | null
  clients: {
    id: string
    name: string
    cuit: string
  } | null
}

type FormState = {
  clientId: string
  name: string
  username: string
  password: string
}

export default function ClientesConfigPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerUser[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [form, setForm] = useState<FormState>({
    clientId: '',
    name: '',
    username: '',
    password: '',
  })

  useEffect(() => {
    loadPage()
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

  async function loadPage() {
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    const currentCompanyId = await getCompanyId()

    if (!currentCompanyId) {
      setCompanyId(null)
      setCustomers([])
      setClients([])
      setErrorMsg('No se encontró la empresa del usuario.')
      setLoading(false)
      return
    }

    setCompanyId(currentCompanyId)

    const [customersRes, clientsRes] = await Promise.all([
      supabase
        .from('customer_users')
        .select(`
          id,
          name,
          email,
          active,
          client_id,
          clients (
            id,
            name,
            cuit
          )
        `)
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false }),

      supabase
        .from('clients')
        .select('id, name, cuit, active')
        .eq('company_id', currentCompanyId)
        .eq('active', true)
        .order('name', { ascending: true }),
    ])

    if (customersRes.error) {
      setErrorMsg('No se pudieron cargar los usuarios clientes.')
    }

    if (clientsRes.error) {
      setErrorMsg('No se pudieron cargar los clientes del sistema.')
    }

    const normalizedCustomers = (customersRes.data || []).map((item: any) => ({
      ...item,
      clients: Array.isArray(item.clients)
        ? item.clients[0] || null
        : item.clients || null,
    }))

    setCustomers(normalizedCustomers)
    setClients(clientsRes.data || [])
    setLoading(false)
  }

  async function handleCreate() {
    setErrorMsg('')
    setSuccessMsg('')

    if (!companyId) {
      setErrorMsg('No se encontró la empresa del usuario.')
      return
    }

    if (!form.clientId) {
      setErrorMsg('Seleccioná el cliente del sistema que vas a enlazar.')
      return
    }

    if (!form.name.trim()) {
      setErrorMsg('Ingresá el nombre visible del usuario cliente.')
      return
    }

    if (!form.username.trim()) {
      setErrorMsg('Ingresá un usuario o email.')
      return
    }

    if (!form.password.trim()) {
      setErrorMsg('Ingresá una contraseña.')
      return
    }

    setSaving(true)

    const res = await fetch('/api/customer-users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: form.clientId,
        name: form.name,
        username: form.username,
        password: form.password,
        companyId,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setErrorMsg(data.error || 'Error al crear usuario cliente.')
      setSaving(false)
      return
    }

    setForm({
      clientId: '',
      name: '',
      username: '',
      password: '',
    })
    setClientSearch('')
    setShowModal(false)
    setSuccessMsg('Usuario cliente creado y enlazado correctamente.')
    await loadPage()
    setSaving(false)
  }

  async function toggleActive(id: string, current: boolean) {
    setUpdatingId(id)
    setErrorMsg('')
    setSuccessMsg('')

    const { error } = await supabase
      .from('customer_users')
      .update({ active: !current })
      .eq('id', id)

    if (error) {
      setErrorMsg('No se pudo actualizar el estado del usuario cliente.')
      setUpdatingId(null)
      return
    }

    setCustomers((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, active: !current } : item
      )
    )

    setSuccessMsg(
      current
        ? 'Usuario cliente desactivado correctamente.'
        : 'Usuario cliente activado correctamente.'
    )

    setUpdatingId(null)
  }

  function openCreateModal() {
    setErrorMsg('')
    setSuccessMsg('')
    setShowModal(true)
  }

  function closeCreateModal() {
    if (saving) return

    setShowModal(false)
    setForm({
      clientId: '',
      name: '',
      username: '',
      password: '',
    })
    setClientSearch('')
  }

  function handleSelectClient(clientId: string) {
    const selectedClient = clients.find((client) => client.id === clientId)

    setForm((prev) => ({
      ...prev,
      clientId,
      name: selectedClient?.name || prev.name,
    }))
  }

  const linkedClientIds = useMemo(() => {
    return new Set(
      customers
        .map((customer) => customer.client_id)
        .filter(Boolean)
    )
  }, [customers])

  const availableClients = useMemo(() => {
    return clients.filter((client) => !linkedClientIds.has(client.id))
  }, [clients, linkedClientIds])

  const filteredAvailableClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim()

    if (!q) return availableClients

    return availableClients.filter((client) => {
      return (
        client.name.toLowerCase().includes(q) ||
        client.cuit.toLowerCase().includes(q)
      )
    })
  }, [availableClients, clientSearch])

  const selectedClient = clients.find((client) => client.id === form.clientId)

  const activeCustomers = customers.filter((c) => c.active).length
  const inactiveCustomers = customers.filter((c) => !c.active).length
  const linkedCustomers = customers.filter((c) => c.client_id).length

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
              Creá usuarios para que tus clientes ingresen al portal y enlazalos
              con el cliente real del sistema para mostrar su cuenta corriente.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadPage}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-60"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:-translate-y-0.5 hover:bg-blue-500"
            >
              <Plus size={18} />
              Nuevo usuario cliente
            </button>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {successMsg}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Usuarios creados"
          value={customers.length}
          icon={Users}
          tone="blue"
        />

        <SummaryCard
          title="Enlazados"
          value={linkedCustomers}
          icon={Link2}
          tone="blue"
        />

        <SummaryCard
          title="Activos"
          value={activeCustomers}
          icon={UserCheck}
          tone="green"
        />

        <SummaryCard
          title="Inactivos"
          value={inactiveCustomers}
          icon={UserX}
          tone="slate"
        />
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white p-5">
          <h2 className="text-xl font-black text-slate-950">
            Usuarios clientes
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Administrá quiénes pueden entrar al portal y qué cliente del sistema
            tienen asociado.
          </p>
        </div>

        {loading ? (
          <LoadingState />
        ) : customers.length === 0 ? (
          <EmptyState onCreate={openCreateModal} />
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHead>Usuario cliente</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Cliente enlazado</TableHead>
                    <TableHead align="center">Estado</TableHead>
                    <TableHead align="right">Acciones</TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="transition hover:bg-blue-50/40">
                      <td className="px-5 py-4">
                        <CustomerIdentity customer={customer} />
                      </td>

                      <td className="px-5 py-4">
                        <EmailBadge email={customer.email} />
                      </td>

                      <td className="px-5 py-4">
                        <LinkedClientBadge customer={customer} />
                      </td>

                      <td className="px-5 py-4 text-center">
                        <StatusBadge active={customer.active} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => toggleActive(customer.id, customer.active)}
                          disabled={updatingId === customer.id}
                          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            customer.active
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {updatingId === customer.id && (
                            <Loader2 size={14} className="animate-spin" />
                          )}
                          {customer.active ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 xl:hidden">
              {customers.map((customer) => (
                <article
                  key={customer.id}
                  className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <CustomerIdentity customer={customer} />
                    <StatusBadge active={customer.active} />
                  </div>

                  <div className="mt-4 space-y-3">
                    <EmailBadge email={customer.email} />
                    <LinkedClientBadge customer={customer} />
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleActive(customer.id, customer.active)}
                    disabled={updatingId === customer.id}
                    className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      customer.active
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {updatingId === customer.id && (
                      <Loader2 size={14} className="animate-spin" />
                    )}
                    {customer.active ? 'Desactivar' : 'Activar'}
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/95 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

            <div className="relative z-10 p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Nuevo usuario cliente
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Seleccioná un cliente del sistema y creá sus credenciales de acceso.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={saving}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-5">
                <section className="rounded-3xl border border-slate-200 bg-white p-4">
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Cliente del sistema *
                  </label>

                  <div className="relative mb-3">
                    <Search
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Buscar por nombre o CUIT..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <select
                    value={form.clientId}
                    onChange={(e) => handleSelectClient(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Seleccionar cliente</option>

                    {filteredAvailableClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} - CUIT {client.cuit}
                      </option>
                    ))}
                  </select>

                  {availableClients.length === 0 && (
                    <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                      Todos los clientes activos ya tienen un usuario de portal asociado.
                    </p>
                  )}

                  {selectedClient && (
                    <div className="mt-3 rounded-2xl bg-blue-50 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-blue-500">
                        Cliente enlazado
                      </p>
                      <p className="mt-1 font-black text-slate-950">
                        {selectedClient.name}
                      </p>
                      <p className="text-sm font-semibold text-slate-500">
                        CUIT: {selectedClient.cuit}
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-4 text-base font-black text-slate-950">
                    Credenciales de acceso
                  </h3>

                  <div className="space-y-4">
                    <InputBox
                      icon={User}
                      placeholder="Nombre visible del usuario"
                      value={form.name}
                      onChange={(value) => setForm({ ...form, name: value })}
                    />

                    <InputBox
                      icon={Mail}
                      placeholder="Usuario o email"
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
                </section>
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || availableClients.length === 0}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 size={17} className="animate-spin" />}
                {saving ? 'Creando...' : 'Crear usuario cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomerIdentity({ customer }: { customer: CustomerUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
        <Users size={20} />
      </div>

      <div className="min-w-0">
        <p className="truncate font-black text-slate-950">
          {customer.name}
        </p>
        <p className="text-xs font-semibold text-slate-400">
          Usuario cliente
        </p>
      </div>
    </div>
  )
}

function EmailBadge({ email }: { email: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
      <Mail size={14} />
      <span className="truncate">{email}</span>
    </span>
  )
}

function LinkedClientBadge({ customer }: { customer: CustomerUser }) {
  if (!customer.client_id || !customer.clients) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700">
        <Link2 size={14} />
        Sin cliente enlazado
      </span>
    )
  }

  return (
    <div className="inline-flex max-w-full flex-col rounded-2xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
      <span className="inline-flex items-center gap-2">
        <Building2 size={14} />
        <span className="truncate">{customer.clients.name}</span>
      </span>
      <span className="mt-1 inline-flex items-center gap-2 text-xs text-blue-500">
        <IdCard size={13} />
        CUIT: {customer.clients.cuit}
      </span>
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${
        active
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-600'
      }`}
    >
      {active ? <UserCheck size={14} /> : <UserX size={14} />}
      {active ? 'Activo' : 'Inactivo'}
    </span>
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
  icon: LucideIcon
  tone: 'blue' | 'green' | 'slate'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${styles[tone]}`}
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
  icon: LucideIcon
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

function TableHead({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <th
      className={`px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500 ${
        align === 'right'
          ? 'text-right'
          : align === 'center'
            ? 'text-center'
            : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center p-14 text-center">
      <Loader2 className="mb-3 animate-spin text-blue-600" size={30} />
      <p className="font-bold text-slate-600">Cargando usuarios clientes...</p>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
        <Users size={30} />
      </div>
      <h3 className="text-lg font-black text-slate-900">
        No hay usuarios clientes creados
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Creá el primer acceso y enlazalo a un cliente del sistema.
      </p>

      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
      >
        <Plus size={18} />
        Crear usuario cliente
      </button>
    </div>
  )
}