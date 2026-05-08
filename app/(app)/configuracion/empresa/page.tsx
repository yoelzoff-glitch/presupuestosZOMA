'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getUserCompanyId } from '@/lib/getUserCompany'
import { toast } from 'sonner'
import {
  Building2,
  ArrowLeft,
  Save,
  Loader2,
  Upload,
  Image as ImageIcon,
  Globe,
  Mail,
  Phone,
  MapPin,
  FileText,
} from 'lucide-react'
import Link from 'next/link'

type Company = {
  id: string
  name: string
  cuit: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo_url: string | null
}

export default function EmpresaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [company, setCompany] = useState<Company | null>(null)

  useEffect(() => {
    loadCompany()
  }, [])

  async function loadCompany() {
    setLoading(true)
    const companyId = await getUserCompanyId()

    if (!companyId) {
      toast.error('No se pudo encontrar la empresa')
      router.push('/configuracion')
      return
    }

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (error) {
      toast.error('Error al cargar datos de la empresa')
      console.error(error)
    } else {
      setCompany(data)
    }
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!company) return

    setSaving(true)
    const { error } = await supabase
      .from('companies')
      .update({
        name: company.name,
        cuit: company.cuit,
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website,
        logo_url: company.logo_url,
      })
      .eq('id', company.id)

    if (error) {
      toast.error('Error al guardar los cambios')
      console.error(error)
    } else {
      toast.success('Datos actualizados correctamente')
    }
    setSaving(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !company) return

    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${company.id}-${Math.random()}.${fileExt}`
      const filePath = `logos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath)

      setCompany({ ...company, logo_url: publicUrl })
      
      // Update company immediately
      await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', company.id)

      toast.success('Logo subido correctamente')
    } catch (error: any) {
      toast.error('Error al subir el logo: ' + (error.message || 'Error desconocido'))
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  if (!company) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/configuracion"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-950">Datos de la empresa</h1>
            <p className="text-sm font-medium text-slate-500">Configurá la información que aparece en tus presupuestos.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Guardar cambios
        </button>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Logo Card */}
        <div className="md:col-span-1">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-400">Logo de la empresa</h3>
            
            <div className="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 transition hover:border-blue-400 hover:bg-blue-50/30">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt="Logo"
                  className="h-full w-full object-contain p-4"
                />
              ) : (
                <div className="text-center">
                  <ImageIcon className="mx-auto mb-2 text-slate-300" size={40} />
                  <p className="text-xs font-bold text-slate-400 text-balance px-4">Subí tu logo en PNG o JPG</p>
                </div>
              )}

              <label className="absolute inset-0 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                />
                <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-900 shadow-xl">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {company.logo_url ? 'Cambiar logo' : 'Subir logo'}
                </div>
              </label>
            </div>
            
            <p className="mt-4 text-xs font-medium leading-relaxed text-slate-500">
              Este logo se utilizará en la cabecera de todos los presupuestos generados por el sistema.
            </p>
          </section>
        </div>

        {/* Info Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSave} className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-6 text-sm font-black uppercase tracking-widest text-slate-400">Información General</h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 ml-1">
                    <Building2 size={16} className="text-slate-400" />
                    Nombre comercial / Razón Social
                  </label>
                  <input
                    type="text"
                    value={company.name || ''}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="Ej: Zoma Tech S.A."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 ml-1">
                    <FileText size={16} className="text-slate-400" />
                    CUIT
                  </label>
                  <input
                    type="text"
                    value={company.cuit || ''}
                    onChange={(e) => setCompany({ ...company, cuit: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="30-XXXXXXXX-X"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 ml-1">
                    <Mail size={16} className="text-slate-400" />
                    Email de contacto
                  </label>
                  <input
                    type="email"
                    value={company.email || ''}
                    onChange={(e) => setCompany({ ...company, email: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="contacto@tuempresa.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 ml-1">
                    <Phone size={16} className="text-slate-400" />
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={company.phone || ''}
                    onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="+54 11 ...."
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 ml-1">
                    <Globe size={16} className="text-slate-400" />
                    Sitio Web
                  </label>
                  <input
                    type="text"
                    value={company.website || ''}
                    onChange={(e) => setCompany({ ...company, website: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="www.tuempresa.com"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 ml-1">
                    <MapPin size={16} className="text-slate-400" />
                    Dirección Comercial
                  </label>
                  <input
                    type="text"
                    value={company.address || ''}
                    onChange={(e) => setCompany({ ...company, address: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="Calle, Ciudad, Provincia"
                  />
                </div>
              </div>
            </section>
          </form>
        </div>
      </div>
    </div>
  )
}
