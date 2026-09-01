'use client'

import { useState, useEffect } from 'react'
import { 
  ShieldCheck, 
  AlertCircle, 
  Save, 
  Key, 
  CheckCircle2, 
  Loader2, 
  RefreshCw,
  Server,
  Building2,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'

interface EnvironmentMeta {
  configured: boolean
  environment: 'homo' | 'prod'
  cuit: string
  punto_venta: number
  tipo_contribuyente: string
  certificate_configured: boolean
  key_configured: boolean
  certificate_fingerprint?: string
  verified_at: string | null
}

export default function ConfigFiscalPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  
  // Tab de entorno activo
  const [activeEnv, setActiveEnv] = useState<'homo' | 'prod'>('homo')
  
  // Metadatos globales recibidos de GET /api/afip/config
  const [environments, setEnvironments] = useState<{ homo: EnvironmentMeta; prod: EnvironmentMeta }>({
    homo: {
      configured: false,
      environment: 'homo',
      cuit: '',
      punto_venta: 0,
      tipo_contribuyente: 'monotributo',
      certificate_configured: false,
      key_configured: false,
      verified_at: null
    },
    prod: {
      configured: false,
      environment: 'prod',
      cuit: '',
      punto_venta: 0,
      tipo_contribuyente: 'monotributo',
      certificate_configured: false,
      key_configured: false,
      verified_at: null
    }
  })

  // Formularios locales por entorno (sin placeholders en cert/key)
  const [formData, setFormData] = useState({
    homo: { cuit: '', punto_venta: '', tipo_contribuyente: 'monotributo', cert_content: '', key_content: '' },
    prod: { cuit: '', punto_venta: '', tipo_contribuyente: 'monotributo', cert_content: '', key_content: '' }
  })

  const [isEditingCreds, setIsEditingCreds] = useState<{ homo: boolean; prod: boolean }>({
    homo: false,
    prod: false
  })

  async function loadConfig() {
    try {
      setLoading(true)
      const response = await fetch('/api/afip/config')
      const data = await response.json()

      if (response.ok && data.environments) {
        setEnvironments(data.environments)
        setFormData({
          homo: {
            cuit: data.environments.homo?.cuit || '',
            punto_venta: data.environments.homo?.punto_venta ? String(data.environments.homo.punto_venta) : '',
            tipo_contribuyente: data.environments.homo?.tipo_contribuyente || 'monotributo',
            cert_content: '',
            key_content: ''
          },
          prod: {
            cuit: data.environments.prod?.cuit || '',
            punto_venta: data.environments.prod?.punto_venta ? String(data.environments.prod.punto_venta) : '',
            tipo_contribuyente: data.environments.prod?.tipo_contribuyente || 'monotributo',
            cert_content: '',
            key_content: ''
          }
        })

        setIsEditingCreds({
          homo: !data.environments.homo?.configured,
          prod: !data.environments.prod?.configured
        })
      }
    } catch (err) {
      toast.error('Error al cargar configuración fiscal')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const currentMeta = environments[activeEnv]
  const currentForm = formData[activeEnv]
  const isCurrentEditing = isEditingCreds[activeEnv]

  const handleSave = async () => {
    setSaving(true)
    try {
      const ptoVtaNum = parseInt(currentForm.punto_venta, 10)
      if (isNaN(ptoVtaNum) || ptoVtaNum <= 0) {
        throw new Error('El Punto de Venta debe ser un número entero mayor a 0.')
      }

      const payload: any = {
        environment: activeEnv,
        cuit: currentForm.cuit,
        punto_venta: ptoVtaNum,
        tipo_contribuyente: currentForm.tipo_contribuyente
      }

      if (currentForm.cert_content.trim() || currentForm.key_content.trim()) {
        payload.cert_content = currentForm.cert_content.trim()
        payload.key_content = currentForm.key_content.trim()
      }

      const response = await fetch('/api/afip/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al guardar la configuración')
      }

      toast.success(result.message || 'Configuración guardada y cifrada correctamente')
      setIsEditingCreds(prev => ({ ...prev, [activeEnv]: false }))
      await loadConfig()
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      const response = await fetch('/api/afip/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: activeEnv })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(result.message)
        await loadConfig()
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast.error('Prueba de conexión fallida: ' + error.message)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500">
        <Loader2 className="animate-spin text-blue-600 mb-3" size={32} />
        <p className="font-bold text-sm">Cargando configuración fiscal...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configuración Fiscal ARCA</h1>
          <p className="text-slate-500 font-medium">Gestión segura e independiente de credenciales para Homologación y Producción.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testing || saving || !currentMeta.configured}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-5 py-3 rounded-2xl font-black hover:bg-slate-200 transition-all disabled:opacity-40"
          >
            {testing ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
            Probar Conexión ({activeEnv === 'prod' ? 'PROD' : 'HOMO'})
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving || testing}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Guardar {activeEnv === 'prod' ? 'Producción' : 'Homologación'}
          </button>
        </div>
      </div>

      {/* Tabs Selector de Entorno */}
      <div className="grid grid-cols-2 gap-4 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveEnv('homo')}
          className={`flex items-center justify-between p-4 rounded-xl font-black text-sm transition-all ${
            activeEnv === 'homo' 
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <Server size={20} className={activeEnv === 'homo' ? 'text-amber-600' : 'text-slate-400'} />
            <div className="text-left">
              <p>Homologación (Testing)</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Servidores de Prueba</p>
            </div>
          </div>
          <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-extrabold ${
            environments.homo.verified_at ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            environments.homo.configured ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-400'
          }`}>
            {environments.homo.verified_at ? 'Validado' : environments.homo.configured ? 'Configurado' : 'Sin Configurar'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveEnv('prod')}
          className={`flex items-center justify-between p-4 rounded-xl font-black text-sm transition-all ${
            activeEnv === 'prod' 
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <Building2 size={20} className={activeEnv === 'prod' ? 'text-emerald-600' : 'text-slate-400'} />
            <div className="text-left">
              <p>Producción (Oficial)</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Facturación Legal Real</p>
            </div>
          </div>
          <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-extrabold ${
            environments.prod.verified_at ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            environments.prod.configured ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-400'
          }`}>
            {environments.prod.verified_at ? 'Validado' : environments.prod.configured ? 'Configurado' : 'Sin Configurar'}
          </span>
        </button>
      </div>

      {/* Alerta de Entorno Activo */}
      {activeEnv === 'prod' ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-xs font-bold">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
          <div>
            <p className="font-black uppercase tracking-wide text-emerald-950">Modo Producción Activo</p>
            <p className="mt-0.5 font-medium">Los comprobantes emitidos en este entorno tendrán validez fiscal ante ARCA. Requiere certificados de Producción.</p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-800 text-xs font-bold">
          <AlertCircle size={20} className="shrink-0 text-amber-600" />
          <div>
            <p className="font-black uppercase tracking-wide text-amber-950">Modo Homologación Activo</p>
            <p className="mt-0.5 font-medium">Entorno de pruebas seguras. Los comprobantes no generan obligaciones fiscales.</p>
          </div>
        </div>
      )}

      {/* Grid de Formulario */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Columna Izquierda: Datos Fiscales */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-6">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">CUIT de la Empresa</label>
              <input
                type="text"
                placeholder="20123456789 (11 dígitos)"
                value={currentForm.cuit}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  [activeEnv]: { ...prev[activeEnv], cuit: e.target.value.replace(/[-_ ]/g, '') }
                }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Punto de Venta ({activeEnv === 'prod' ? 'PROD' : 'HOMO'})</label>
              <input
                type="number"
                placeholder="Ej: 5"
                value={currentForm.punto_venta}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  [activeEnv]: { ...prev[activeEnv], punto_venta: e.target.value }
                }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Condición IVA</label>
              <select
                value={currentForm.tipo_contribuyente}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  [activeEnv]: { ...prev[activeEnv], tipo_contribuyente: e.target.value }
                }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="monotributo">Monotributista</option>
                <option value="responsable_inscripto">Responsable Inscripto</option>
                <option value="exento">Exento</option>
              </select>
            </div>
          </div>

          {/* Tarjeta de Estado de Validación */}
          <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-wide">
              <Calendar size={16} className="text-slate-500" />
              <span>Estado de Validación</span>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Última validación:</span>
                <span className="font-bold text-slate-900">
                  {currentMeta.verified_at ? new Date(currentMeta.verified_at).toLocaleString('es-AR') : 'Nunca validado'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Punto de venta:</span>
                <span className="font-bold text-slate-900">
                  {currentMeta.punto_venta > 0 ? `Nro. ${currentMeta.punto_venta}` : 'No definido'}
                </span>
              </div>
              {currentMeta.certificate_fingerprint && (
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500 font-medium">SHA-256 Cert:</span>
                  <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                    {currentMeta.certificate_fingerprint.substring(0, 12)}...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Certificados */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
              <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Key size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 tracking-tight">
                  Certificados Digitales ({activeEnv === 'prod' ? 'Producción' : 'Homologación'})
                </h3>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">
                  Cifrados con AES-256-GCM en el servidor
                </p>
              </div>
            </div>

            {!isCurrentEditing && currentMeta.configured ? (
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-wide">Certificado Digital (.crt)</p>
                      <p className="text-[11px] font-medium text-emerald-700">Cifrado y activo en el servidor para {activeEnv.toUpperCase()}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">Activo</span>
                </div>

                <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-wide">Clave Privada (.key)</p>
                      <p className="text-[11px] font-medium text-emerald-700">Cifrada y resguardada para {activeEnv.toUpperCase()}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">Activa</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingCreds(prev => ({ ...prev, [activeEnv]: true }))}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 text-slate-600 hover:text-blue-600 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  <RefreshCw size={14} /> Reemplazar Credenciales de {activeEnv.toUpperCase()}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {currentMeta.configured && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          [activeEnv]: { ...prev[activeEnv], cert_content: '', key_content: '' }
                        }))
                        setIsEditingCreds(prev => ({ ...prev, [activeEnv]: false }))
                      }}
                      className="text-xs font-black text-slate-400 hover:text-slate-700 uppercase tracking-wider"
                    >
                      Cancelar Edición
                    </button>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Contenido del Certificado (.crt)</label>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black">-----BEGIN CERTIFICATE-----</span>
                  </div>
                  <textarea
                    placeholder="Pegá aquí el texto de tu archivo .crt (debe comenzar con -----BEGIN CERTIFICATE-----)"
                    value={currentForm.cert_content}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      [activeEnv]: { ...prev[activeEnv], cert_content: e.target.value }
                    }))}
                    className="w-full h-36 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Contenido de la Clave Privada (.key)</label>
                    <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-black">-----BEGIN PRIVATE KEY-----</span>
                  </div>
                  <textarea
                    placeholder="Pegá aquí el texto de tu archivo .key (debe comenzar con -----BEGIN PRIVATE KEY-----)"
                    value={currentForm.key_content}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      [activeEnv]: { ...prev[activeEnv], key_content: e.target.value }
                    }))}
                    className="w-full h-36 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  />
                </div>
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-4 flex items-start gap-3 border border-slate-200 text-xs text-slate-500">
              <ShieldCheck className="text-slate-400 shrink-0 mt-0.5" size={18} />
              <p className="leading-relaxed font-medium">
                ZOMA valida criptográficamente que la clave privada coincida con el certificado antes de guardar y cifra ambos componentes con AES-256-GCM.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
