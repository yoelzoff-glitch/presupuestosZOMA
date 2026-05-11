'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Building2,
  CheckCircle2,
  IdCard,
  Loader2,
  MapPin,
  Upload,
  Mail,
  Phone,
  UserCheck,
  Lock,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

type SellerProfile = { id: string; full_name: string }

export default function NuevoCliente() {
  const [cuit, setCuit] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedSellerId, setSelectedSellerId] = useState<string>('')
  
  const [sellers, setSellers] = useState<SellerProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [planType, setPlanType] = useState<string>('base')

  useEffect(() => {
    async function loadSellers() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const { data: profile } = await supabase
        .from('users_profiles')
        .select('company_id, company:companies(plan_type)')
        .eq('id', userData.user.id)
        .single()
      
      if (!profile?.company_id) return
      
      setCompanyId(profile.company_id)
      setPlanType((profile.company as any)?.plan_type || 'base')

      const { data: sellersData } = await supabase.from('users_profiles').select('id, full_name').eq('company_id', profile.company_id).order('full_name')
      setSellers(sellersData || [])
    }
    loadSellers()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(''); setSuccessMsg('')

    if (!name.trim()) { setErrorMsg('El Nombre es obligatorio.'); return }
    if (!companyId) { setErrorMsg('No se detectó la empresa.'); return }

    setLoading(true)
    try {
      const { error } = await supabase.from('clients').insert({
        company_id: companyId,
        cuit: cuit.trim() || null,
        name: name.trim(),
        address: address.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        seller_id: selectedSellerId || null
      })

      if (error) throw error
      setSuccessMsg('Cliente creado correctamente.')
      setCuit(''); setName(''); setAddress(''); setEmail(''); setPhone(''); setSelectedSellerId('')
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el cliente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !companyId) return
    setImporting(true)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets[workbook.SheetNames[0]])

      const payload = rows.map(r => {
        // Normalizar las llaves del objeto a minúsculas y sin espacios/guiones
        const normalizedRow: any = {}
        Object.keys(r).forEach(key => {
          const normalizedKey = key.toLowerCase().trim().replace(/[\s_]/g, '')
          normalizedRow[normalizedKey] = r[key]
        })

        const name = normalizedRow.nombre || normalizedRow.name || normalizedRow.razonsocial || normalizedRow.cliente || ''
        if (!name) return null

        return {
          company_id: companyId,
          cuit: String(normalizedRow.cuit || normalizedRow.dni || '').replace(/\D/g, '') || null,
          name: String(name).trim(),
          address: String(normalizedRow.direccion || normalizedRow.address || normalizedRow.domicilio || ''),
          email: String(normalizedRow.email || normalizedRow.mail || ''),
          phone: String(normalizedRow.telefono || normalizedRow.phone || normalizedRow.celular || ''),
          seller_id: selectedSellerId || null
        }
      }).filter(Boolean) as any[]

      if (payload.length === 0) {
        throw new Error('No se encontraron clientes válidos. Asegúrate de que la columna se llame "Nombre" o "Razon Social".')
      }

      const { error } = await supabase.from('clients').insert(payload)
      if (error) throw error
      setSuccessMsg(`Se importaron ${payload.length} clientes correctamente asignados.`)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error en la importación.')
    } finally {
      setImporting(false); e.target.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8 overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-xl">
        <div className="bg-slate-950 px-8 py-12 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full -mr-48 -mt-48"></div>
          <div className="relative z-10 text-center sm:text-left">
            <h1 className="text-4xl font-black tracking-tight">Alta de Clientes</h1>
            <p className="mt-4 text-slate-400 font-medium max-w-xl">Cargá la base de datos de tu empresa de forma manual o masiva mediante Excel.</p>
          </div>
        </div>

        <div className="p-8 lg:p-12 space-y-10">
          {/* Asignación de Vendedor Global */}
          <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 flex flex-col sm:flex-row items-center gap-6">
             <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20"><UserCheck size={28} /></div>
             <div className="flex-1 text-center sm:text-left">
                <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Vendedor Asignado</p>
                <p className="text-xs font-bold text-slate-500">¿A quién le pertenece este cliente? (Opcional)</p>
             </div>
              <div className="relative group">
                <select 
                  value={selectedSellerId} 
                  disabled={planType === 'base'}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className={`w-full sm:w-64 rounded-2xl border-2 bg-white px-5 py-3.5 text-sm font-black text-slate-700 shadow-sm outline-none transition ${
                    planType === 'base' 
                      ? 'border-slate-100 opacity-60 cursor-not-allowed' 
                      : 'border-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                  }`}
                >
                  <option value="">Sin asignar (Admin)</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>

                {planType === 'base' && (
                  <div className="absolute -top-3 -right-3 flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-xl ring-2 ring-white animate-bounce">
                    <Lock size={10} /> PRO
                  </div>
                )}
              </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
             {/* Formulario Manual */}
             <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center gap-3 mb-2"><Building2 className="text-blue-600" size={20} /><h3 className="text-lg font-black text-slate-900">Carga Manual</h3></div>
                
                {errorMsg && <div className="p-4 bg-red-50 text-red-700 text-xs font-black rounded-2xl border border-red-100">{errorMsg}</div>}
                {successMsg && <div className="p-4 bg-emerald-50 text-emerald-700 text-xs font-black rounded-2xl border border-emerald-100">{successMsg}</div>}

                <div className="space-y-4">
                  <input value={name} required onChange={(e) => setName(e.target.value)} placeholder="Nombre o Razón Social *" className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-5 py-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition" />
                  <input value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="CUIT / DNI (Solo números)" className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-5 py-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition" />
                  <input value={email} type="email" onChange={(e) => setEmail(e.target.value)} placeholder="Email de contacto" className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-5 py-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono / WhatsApp" className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-5 py-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition" />
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección completa" className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-5 py-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition" />
                </div>

                <button disabled={loading} type="submit" className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black text-sm hover:bg-blue-600 transition shadow-xl active:scale-95 disabled:opacity-50">
                  {loading ? 'Guardando...' : 'Crear Cliente'}
                </button>
             </form>

             {/* Importación Excel */}
             <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2"><Upload className="text-blue-600" size={20} /><h3 className="text-lg font-black text-slate-900">Importación Masiva</h3></div>
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/30 text-center flex flex-col items-center gap-4 group hover:border-blue-400 transition">
                   <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 shadow-sm transition"><Upload size={32} /></div>
                   <p className="text-sm font-bold text-slate-500 px-4">Arrastrá tu archivo Excel o hacé clic abajo. Se asignará al vendedor seleccionado arriba.</p>
                   <label className="cursor-pointer px-8 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition">
                      {importing ? 'Importando...' : 'Seleccionar Excel'}
                      <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} disabled={importing} className="hidden" />
                   </label>
                </div>
                <div className="bg-slate-100/50 p-5 rounded-2xl">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Formato sugerido:</p>
                   <p className="text-xs font-bold text-slate-500 leading-relaxed italic">"El Excel puede contener columnas como 'Nombre', 'Razon Social', 'CUIT', 'Email', 'Telefono', 'Direccion'. El sistema reconocerá automáticamente las variaciones."</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}