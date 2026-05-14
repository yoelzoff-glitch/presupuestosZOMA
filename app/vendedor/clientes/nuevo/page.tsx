'use client'

import { useState } from 'react'
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
  ArrowLeft
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function VendedorNuevoCliente() {
  const router = useRouter()
  const [cuit, setCuit] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [clientType, setClientType] = useState<'consumidor_final' | 'distribuidor'>('consumidor_final')
  
  const [loading, setLoading] = useState(false)
// ... (omitting lines for brevity in instruction, will provide full replacement below)
  const [importing, setImporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg('')

    if (!name.trim()) {
      setErrorMsg('El Nombre es obligatorio.')
      return
    }

    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('No autenticado')

      const { data: profile } = await supabase
        .from('users_profiles')
        .select('company_id, role')
        .eq('id', userData.user.id)
        .single()

      if (!profile?.company_id) throw new Error('No se encontró la empresa')

      const { error } = await supabase.from('clients').insert({
        company_id: profile.company_id,
        cuit: cuit.trim() || null,
        name: name.trim(),
        address: address.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        seller_id: profile.role === 'vendedor' ? userData.user.id : null,
        client_type: clientType
      })

      if (error) throw error

      toast.success('Cliente creado correctamente')
      router.push('/vendedor/clientes')
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el cliente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImporting(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('No autenticado')
      const { data: profile } = await supabase.from('users_profiles').select('company_id, role').eq('id', userData.user.id).single()
      if (!profile?.company_id) throw new Error('No se encontró la empresa')

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets[workbook.SheetNames[0]])

      const payload = rows.map(r => {
        const normalizedRow: any = {}
        Object.keys(r).forEach(key => {
          const normalizedKey = key.toLowerCase().trim().replace(/[\s_]/g, '')
          normalizedRow[normalizedKey] = r[key]
        })

        const name = normalizedRow.nombre || normalizedRow.name || normalizedRow.razonsocial || normalizedRow.cliente || normalizedRow.empresa || ''
        if (!name) return null

        const tipoStr = String(normalizedRow.tipo || normalizedRow.type || normalizedRow.categoria || normalizedRow.clasificacion || '').toLowerCase()
        let detectedType: 'consumidor_final' | 'distribuidor' = 'consumidor_final'
        if (tipoStr.includes('dist') || tipoStr.includes('mayo') || tipoStr.includes('revend')) {
          detectedType = 'distribuidor'
        }

        return {
          company_id: profile.company_id,
          cuit: String(normalizedRow.cuit || normalizedRow.dni || normalizedRow.cuil || normalizedRow.identificacion || '').replace(/\D/g, '') || null,
          name: String(name).trim(),
          address: String(normalizedRow.direccion || normalizedRow.address || normalizedRow.domicilio || normalizedRow.calle || normalizedRow.ubicacion || ''),
          email: String(normalizedRow.email || normalizedRow.mail || normalizedRow.correo || normalizedRow['e-mail'] || ''),
          phone: String(normalizedRow.telefono || normalizedRow.phone || normalizedRow.celular || normalizedRow.whatsapp || normalizedRow.tel || ''),
          seller_id: profile.role === 'vendedor' ? userData.user.id : null,
          client_type: detectedType
        }
      }).filter(Boolean) as any[]

      if (payload.length === 0) throw new Error('No se encontraron clientes válidos en el archivo.')

      const { error } = await supabase.from('clients').insert(payload)
      if (error) throw error
      
      toast.success(`Se importaron ${payload.length} clientes correctamente.`)
      router.push('/vendedor/clientes')
    } catch (err: any) {
      toast.error(err.message || 'Error en la importación.')
    } finally {
      setImporting(false); e.target.value = ''
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <Link 
        href="/vendedor/clientes" 
        className="inline-flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-slate-800 transition"
      >
        <ArrowLeft size={16} /> Volver al listado
      </Link>

      <section className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-900 p-8 text-white">
          <h1 className="text-2xl font-black tracking-tight mb-2">Nuevo Cliente</h1>
          <p className="text-slate-400 text-sm font-medium">Completa los datos para dar de alta un nuevo contacto en tu cartera.</p>
        </div>

        <div className="p-8 space-y-8">
          {/* Importar Excel - Simplificado */}
          <label className="flex items-center justify-between p-5 rounded-2xl border-2 border-dashed border-blue-100 bg-blue-50/30 cursor-pointer hover:border-blue-300 transition group">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                <Upload size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-black text-slate-900">¿Tienes un Excel?</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Importar contactos rápido</p>
              </div>
            </div>
            <input type="file" className="hidden" accept=".xlsx,.xls,.xlsm,.csv" onChange={handleExcelImport} disabled={importing} />
          </label>

          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-red-50 text-red-700 text-sm font-bold border border-red-100">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Nombre / Razón Social *</label>
                <div className="relative">
                  <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Juan Pérez o Empresa S.A."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">CUIT / DNI</label>
                <div className="relative">
                  <IdCard size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={cuit}
                    onChange={(e) => setCuit(e.target.value)}
                    placeholder="Opcional: Solo números"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition shadow-inner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Email</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="mail@ejemplo.com"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition shadow-inner"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Teléfono</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+54 9 ..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition shadow-inner"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Dirección</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle, Número, Ciudad..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition shadow-inner"
                  />
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Tipo de Cliente</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setClientType('consumidor_final')} className={`py-4 px-4 rounded-xl text-xs font-black transition border-2 ${clientType === 'consumidor_final' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500'}`}>CONSUMIDOR FINAL</button>
                  <button type="button" onClick={() => setClientType('distribuidor')} className={`py-4 px-4 rounded-xl text-xs font-black transition border-2 ${clientType === 'distribuidor' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500'}`}>DISTRIBUIDOR</button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
              {loading ? 'Guardando...' : 'Crear Cliente'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
