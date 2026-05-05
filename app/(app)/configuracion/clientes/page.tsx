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

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-blue-200">
          <Users size={14} />
          Usuarios clientes
        </div>

        <h1 className="text-2xl font-black">
          Gestión de clientes con acceso
        </h1>

        <p className="mt-1 text-sm text-slate-300">
          Creá usuarios para que tus clientes vean precios y hagan pedidos.
        </p>
      </section>

      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500"
        >
          <Plus size={16} />
          Nuevo cliente
        </button>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No hay usuarios clientes creados
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-3 text-left">Nombre</th>
                <th className="p-3 text-left">Usuario</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3 font-bold">{c.name}</td>
                  <td className="p-3 text-slate-600">{c.email}</td>

                  <td className="p-3 text-center">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        c.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {c.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>

                  <td className="p-3 text-right">
                    <button
                      onClick={() => toggleActive(c.id, c.active)}
                      className="text-xs font-bold text-blue-600"
                    >
                      {c.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

         {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
                <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-white/90 backdrop-blur-xl shadow-2xl">
                
                {/* Glow */}
                <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
                <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

                <div className="relative z-10 p-6">
                    {/* Header */}
                    <div className="mb-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">
                        Nuevo cliente
                        </h2>
                        <p className="text-xs text-slate-500">
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

                    {/* Inputs */}
                    <div className="space-y-4">
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                        placeholder="Nombre del cliente"
                        value={form.name}
                        onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        />
                    </div>

                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                        placeholder="Usuario (ej: cliente1)"
                        value={form.username}
                        onChange={(e) =>
                            setForm({ ...form, username: e.target.value })
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                        type="password"
                        placeholder="Contraseña"
                        value={form.password}
                        onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        />
                    </div>
                    </div>

                    {/* Botón */}
                    <button
                    onClick={handleCreate}
                    disabled={saving}
                    className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                    {saving ? 'Creando...' : 'Crear cliente'}
                    </button>
                </div>
                </div>
            </div>
          )}
    </div>
  )
}