'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { 
  Users, 
  Plus, 
  Mail, 
  Lock, 
  User, 
  Loader2, 
  ShieldCheck, 
  AlertCircle,
  Search,
  MoreVertical,
} from 'lucide-react'
import { toast } from 'sonner'

export default function VendedoresPage() {
  const [vendedores, setVendedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Form states
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchVendedores()
  }, [])

  async function fetchVendedores() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) return

      const { data, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('role', 'vendedor')
        .order('full_name')

      if (error) throw error
      setVendedores(data || [])
    } catch (error: any) {
      toast.error('Error cargando vendedores: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateVendedor(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName || !email || !password) {
      toast.error('Completá todos los campos')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/vendedores/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, password })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || data.error || 'Error desconocido')

      toast.success('Vendedor creado correctamente')
      setShowModal(false)
      setFullName('')
      setEmail('')
      setPassword('')
      fetchVendedores()
    } catch (error: any) {
      toast.error(error.message || 'Error al crear vendedor')
    } finally {
      setCreating(false)
    }
  }

  const filteredVendedores = vendedores.filter(v => 
    v.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">
            Equipo de Ventas
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Administrá a tus vendedores y sus accesos al sistema.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95"
        >
          <Plus size={18} strokeWidth={3} />
          Nuevo Vendedor
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Users size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Total Vendedores</p>
              <h4 className="text-2xl font-black text-slate-900">{vendedores.length}</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Table */}
      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-2 shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="relative group max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-8 py-5 text-left text-xs font-black uppercase tracking-widest text-slate-500">Vendedor</th>
                <th className="px-8 py-5 text-left text-xs font-black uppercase tracking-widest text-slate-500">Estado</th>
                <th className="px-8 py-5 text-left text-xs font-black uppercase tracking-widest text-slate-500">Rol</th>
                <th className="px-8 py-5 text-right text-xs font-black uppercase tracking-widest text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
                  </td>
                </tr>
              ) : filteredVendedores.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-sm font-bold text-slate-400">
                    No se encontraron vendedores.
                  </td>
                </tr>
              ) : (
                filteredVendedores.map((v) => (
                  <tr key={v.id} className="group transition-colors hover:bg-slate-50/50">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-black">
                          {v.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-slate-900">{v.full_name}</p>
                          <p className="text-xs font-bold text-slate-500">{v.email || 'vendedor@sistema.com'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        <span className="h-1 w-1 rounded-full bg-emerald-700" />
                        Activo
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                        <ShieldCheck size={16} className="text-blue-500" />
                        Vendedor
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                        <MoreVertical size={20} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nueva Vendedor */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !creating && setShowModal(false)} />
          <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-2xl">
            <div className="mb-8">
              <h3 className="text-2xl font-black text-slate-950">Nuevo Vendedor</h3>
              <p className="text-sm font-bold text-slate-500">Completá los datos para crear la cuenta.</p>
            </div>

            <form onSubmit={handleCreateVendedor} className="space-y-5">
              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-500">Nombre Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="ej: Juan Pérez"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-500">Email (Usuario)</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendedor@empresa.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-500">Contraseña Inicial</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} strokeWidth={3} />}
                  Crear Cuenta de Vendedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
