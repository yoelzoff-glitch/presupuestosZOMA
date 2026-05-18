'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  FileText, 
  ShieldCheck, 
  AlertCircle, 
  Save, 
  Key, 
  Settings2,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export default function ConfigFiscalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditingCreds, setIsEditingCreds] = useState(true)
  const [testing, setTesting] = useState(false)
  const [config, setConfig] = useState({
    cuit: '',
    tipo_contribuyente: 'monotributo',
    punto_venta: '',
    cert_content: '',
    key_content: '',
    is_sandbox: true
  })

  const testConnection = async () => {
    setTesting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single()

      if (!profile?.company_id) throw new Error('No se encontró la empresa')

      const response = await fetch('/api/afip/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: profile.company_id })
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Conexión exitosa: ' + result.message)
        console.log('Estado AFIP:', result.status)
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast.error('Error de conexión: ' + error.message)
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    async function loadConfig() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Obtenemos el profile para saber el company_id y validar el plan
        const { data: profile } = await supabase
          .from('users_profiles')
          .select('company_id, company:companies(plan_type)')
          .eq('id', user.id)
          .single()

        if (profile?.company_id) {
          const { data: afipConfig } = await supabase
            .from('afip_configs')
            .select('*')
            .eq('company_id', profile.company_id)
            .single()
          
          if (afipConfig) {
            setConfig({
              cuit: afipConfig.cuit || '',
              tipo_contribuyente: afipConfig.tipo_contribuyente || 'monotributo',
              punto_venta: afipConfig.punto_venta?.toString() || '',
              cert_content: afipConfig.cert_content || '',
              key_content: afipConfig.key_content || '',
              is_sandbox: afipConfig.is_sandbox ?? true
            })
            if (afipConfig.cert_content && afipConfig.key_content) {
              setIsEditingCreds(false)
            } else {
              setIsEditingCreds(true)
            }
          } else {
            setIsEditingCreds(true)
          }
        }
      }
      setLoading(false)
    }
    loadConfig()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single()

      if (!profile?.company_id) throw new Error('No se encontró la empresa')

      const payload = {
        company_id: profile.company_id,
        cuit: config.cuit,
        tipo_contribuyente: config.tipo_contribuyente,
        punto_venta: parseInt(config.punto_venta) || 0,
        cert_content: config.cert_content,
        key_content: config.key_content,
        is_sandbox: config.is_sandbox,
        updated_at: new Date()
      }

      const { error } = await supabase
        .from('afip_configs')
        .upsert(payload, { onConflict: 'company_id' })

      if (error) throw error
      toast.success('Configuración fiscal guardada correctamente')
      setIsEditingCreds(false)
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando configuración...</div>

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configuración Fiscal</h1>
          <p className="text-slate-500 font-medium">Vinculá ZOMA con ARCA para facturación electrónica.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={testConnection}
            disabled={testing || saving}
            className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black hover:bg-slate-200 transition-all disabled:opacity-50"
          >
            {testing ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
            Probar Conexión
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving || testing}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {saving ? <Database className="animate-spin" size={20} /> : <Save size={20} />}
            Guardar Cambios
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Info y Datos Básicos */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">CUIT de la Empresa</label>
              <input
                type="text"
                placeholder="20-12345678-9"
                value={config.cuit}
                onChange={(e) => setConfig({ ...config, cuit: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Punto de Venta</label>
              <input
                type="number"
                placeholder="5"
                value={config.punto_venta}
                onChange={(e) => setConfig({ ...config, punto_venta: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Condición IVA</label>
              <select
                value={config.tipo_contribuyente}
                onChange={(e) => setConfig({ ...config, tipo_contribuyente: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="monotributo">Monotributista</option>
                <option value="responsable_inscripto">Responsable Inscripto</option>
                <option value="exento">Exento</option>
              </select>
            </div>
          </div>

          <div className="bg-amber-50 rounded-[2rem] p-8 border border-amber-100">
             <div className="flex items-center gap-3 text-amber-700 mb-4 font-black text-sm uppercase tracking-wider">
               <AlertCircle size={20} /> Entorno
             </div>
             <div className="flex items-center justify-between bg-white/50 p-4 rounded-2xl border border-amber-200">
                <span className="text-xs font-bold text-amber-900">Modo Testing (Homologación)</span>
                <input 
                  type="checkbox"
                  checked={config.is_sandbox}
                  onChange={(e) => setConfig({...config, is_sandbox: e.target.checked})}
                  className="w-5 h-5 accent-amber-600"
                />
             </div>
             <p className="mt-4 text-[11px] font-medium text-amber-800 leading-relaxed">
               Recomendamos probar siempre en modo Testing antes de pasar a Producción para evitar facturas legales erróneas.
             </p>
          </div>
        </div>

        {/* Certificados */}
        <div className="md:col-span-2 space-y-8">
          <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
               <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Key size={24} />
               </div>
               <div>
                  <h3 className="font-black text-slate-900 tracking-tight">Certificados Digitales</h3>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Credenciales de acceso a Web Services</p>
               </div>
            </div>

            <div className="space-y-6">
            {!isEditingCreds ? (
              <div className="space-y-6">
                <div className="border border-slate-100 rounded-2xl p-6 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-wide">Certificado Digital (.crt)</p>
                      <p className="text-[11px] font-semibold text-emerald-600">Cargado y activo correctamente en ZOMA</p>
                    </div>
                  </div>
                  <span className="text-[9px] bg-slate-100 text-slate-500 font-mono px-3 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                    ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
                  </span>
                </div>

                <div className="border border-slate-100 rounded-2xl p-6 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-wide">Clave Privada (.key)</p>
                      <p className="text-[11px] font-semibold text-emerald-600">Cargada y activa correctamente en ZOMA</p>
                    </div>
                  </div>
                  <span className="text-[9px] bg-slate-100 text-slate-500 font-mono px-3 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                    ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingCreds(true)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 text-slate-500 hover:text-blue-600 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300"
                >
                  <RefreshCw size={14} /> Reemplazar Credenciales Digitales
                </button>
              </div>
            ) : (
              <div className="space-y-6 flex flex-col w-full">
                {config.cert_content && config.key_content && (
                  <button
                    type="button"
                    onClick={() => setIsEditingCreds(false)}
                    className="text-xs font-black text-slate-400 hover:text-slate-600 transition-all uppercase tracking-wider self-end mb-2"
                  >
                    Cancelar Edición
                  </button>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Contenido del Certificado (.crt)</label>
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-black">-----BEGIN CERTIFICATE-----</span>
                  </div>
                  <textarea
                    placeholder="Pegá aquí el contenido de tu archivo .crt"
                    value={config.cert_content}
                    onChange={(e) => setConfig({ ...config, cert_content: e.target.value })}
                    className="w-full h-40 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 text-[11px] font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Contenido de la Clave Privada (.key)</label>
                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-black">-----BEGIN PRIVATE KEY-----</span>
                  </div>
                  <textarea
                    placeholder="Pegá aquí el contenido de tu archivo .key"
                    value={config.key_content}
                    onChange={(e) => setConfig({ ...config, key_content: e.target.value })}
                    className="w-full h-40 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 text-[11px] font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-slate-50 rounded-2xl p-6 flex items-start gap-4">
               <ShieldCheck className="text-slate-400 shrink-0" size={20} />
               <p className="text-xs font-medium text-slate-500 leading-relaxed">
                  Tus certificados se almacenan de forma segura y solo se utilizan para firmar las peticiones ante ARCA. ZOMA nunca compartirá estas credenciales.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
