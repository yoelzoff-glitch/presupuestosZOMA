'use client'

import { useState, useEffect } from 'react'
import { 
  getCompanies, 
  updateCompanyPlan, 
  createNewCompany 
} from './actions'
import { 
  LayoutDashboard, 
  Building2, 
  ShieldCheck, 
  Plus, 
  Zap, 
  Crown, 
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

type Company = {
  id: string
  name: string
  plan_type: 'base' | 'pro'
  created_at: string
}

export default function SuperAdminPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Form state
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  useEffect(() => {
    loadCompanies()
  }, [])

  async function loadCompanies() {
    try {
      const data = await getCompanies()
      setCompanies(data as Company[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleTogglePlan(companyId: string, currentPlan: 'base' | 'pro') {
    const nextPlan = currentPlan === 'base' ? 'pro' : 'base'
    try {
      await updateCompanyPlan(companyId, nextPlan)
      setCompanies(companies.map(c => 
        c.id === companyId ? { ...c, plan_type: nextPlan } : c
      ))
    } catch (err) {
      alert('No se pudo actualizar el plan')
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newCompanyName || !newAdminEmail) return
    
    setCreating(true)
    setMsg({ text: '', type: '' })
    
    try {
      const result = await createNewCompany(newCompanyName, newAdminEmail)
      
      if (result?.error) {
        setMsg({ text: result.error, type: 'error' })
      } else {
        setMsg({ text: '¡Empresa creada con éxito! Se envió el acceso al cliente.', type: 'success' })
        setNewCompanyName('')
        setNewAdminEmail('')
        loadCompanies()
      }
    } catch (err: any) {
      setMsg({ text: 'Error de comunicación con el servidor.', type: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <header className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-700">
            <ShieldCheck size={14} />
            Super Administrador
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">Panel de Control ZOMA</h1>
          <p className="text-slate-500 font-medium">Gestioná tus clientes, planes y onboarding.</p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        {/* Sidebar: New Company */}
        <aside className="space-y-6">
          <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
            <div className="mb-6 flex items-center gap-3 text-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                <Plus size={20} />
              </div>
              <h2 className="text-xl font-black">Dar de alta empresa</h2>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {msg.text && (
                <div className={`flex items-center gap-2 rounded-2xl p-4 text-sm font-bold ${
                  msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {msg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {msg.text}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Nombre Comercial</label>
                <input 
                  type="text" 
                  required
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  placeholder="Ej: Distribuidora Alvear"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Email Dueño / Admin</label>
                <input 
                  type="email" 
                  required
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                  placeholder="admin@ejemplo.com"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <button 
                type="submit"
                disabled={creating}
                className="w-full rounded-2xl bg-slate-950 py-4 text-sm font-black text-white shadow-xl transition-all hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear Empresa y Enviar Acceso'}
              </button>
            </form>
          </section>
        </aside>

        {/* Main: Companies List */}
        <main className="space-y-6">
          <section className="rounded-[2.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            <div className="border-b border-slate-100 p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-950">Empresas registradas</h3>
                  <p className="text-sm font-medium text-slate-500">Total: {companies.length} clientes</p>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar empresa..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 md:w-64"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-4">Empresa</th>
                    <th className="px-4 py-4">Plan Actual</th>
                    <th className="px-4 py-4">Fecha Alta</th>
                    <th className="px-4 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredCompanies.map(company => (
                    <tr key={company.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                            <Building2 size={20} />
                          </div>
                          <span className="font-black text-slate-900">{company.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        {company.plan_type === 'pro' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-600 ring-1 ring-amber-600/20">
                            <Crown size={12} />
                            PLAN PRO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                            PLAN BASE
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-5 text-sm font-bold text-slate-500">
                        {new Date(company.created_at).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-5 text-right">
                        <button 
                          onClick={() => handleTogglePlan(company.id, company.plan_type)}
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
                            company.plan_type === 'base' 
                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          <Zap size={14} />
                          {company.plan_type === 'base' ? 'Pasar a PRO' : 'Bajar a BASE'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
