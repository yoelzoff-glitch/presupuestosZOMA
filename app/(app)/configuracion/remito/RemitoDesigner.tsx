'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  FileText, 
  Maximize2, 
  Move, 
  Save, 
  Settings2, 
  Upload, 
  Trash2,
  ChevronLeft,
  Layout,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

// Tamaños estándar en mm
const PAPER_SIZES = {
  A4: { width: 210, height: 297 },
  OFICIO: { width: 216, height: 356 },
  CARTA: { width: 216, height: 279 },
  CUSTOM: { width: 210, height: 297 }
}

type FieldConfig = {
  id: string
  label: string
  x: number // en mm
  y: number // en mm
  type: 'text' | 'checkbox' | 'table'
}

const AVAILABLE_FIELDS = [
  { id: 'numero', label: 'N° Remito', type: 'text' },
  { id: 'fecha_dia', label: 'Fecha: Día', type: 'text' },
  { id: 'fecha_mes', label: 'Fecha: Mes', type: 'text' },
  { id: 'fecha_anio', label: 'Fecha: Año', type: 'text' },
  { id: 'cliente_nombre', label: 'Nombre Cliente', type: 'text' },
  { id: 'cliente_domicilio', label: 'Domicilio Cliente', type: 'text' },
  { id: 'cliente_cuit', label: 'CUIT Cliente', type: 'text' },
  { id: 'iva_ri', label: 'IVA: Resp. Inscripto', type: 'checkbox' },
  { id: 'iva_mt', label: 'IVA: Monotributo', type: 'checkbox' },
  { id: 'iva_cf', label: 'IVA: Cons. Final', type: 'checkbox' },
  { id: 'tabla_items', label: 'Tabla de Productos', type: 'table' },
]

export default function RemitoDesigner() {
  const [paperSize, setPaperSize] = useState(PAPER_SIZES.A4)
  const [paperKey, setPaperKey] = useState<keyof typeof PAPER_SIZES>('A4')
  const [bgImage, setBgImage] = useState<string | null>(null)
  const [fields, setFields] = useState<FieldConfig[]>([])
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Cargar configuración inicial
  useEffect(() => {
    async function loadConfig() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('users_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (profile?.company_id) {
          setCompanyId(profile.company_id)
          const { data: company } = await supabase
            .from('companies')
            .select('remito_config')
            .eq('id', profile.company_id)
            .single()

          if (company?.remito_config) {
            const config = company.remito_config
            if (config.paperSize) {
              setPaperSize(config.paperSize)
              // Intentar matchear el key si coincide con los estándar
              const key = Object.keys(PAPER_SIZES).find(k => 
                PAPER_SIZES[k as keyof typeof PAPER_SIZES].width === config.paperSize.width && 
                PAPER_SIZES[k as keyof typeof PAPER_SIZES].height === config.paperSize.height
              )
              if (key) setPaperKey(key as keyof typeof PAPER_SIZES)
              else setPaperKey('CUSTOM')
            }
            if (config.fields) setFields(Object.values(config.fields))
            if (config.bgImage) setBgImage(config.bgImage)
          }
        }
      } catch (err) {
        console.error('Error cargando config:', err)
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('La imagen es muy pesada. Máximo 2MB.')
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => setBgImage(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const addField = (fieldBase: typeof AVAILABLE_FIELDS[0]) => {
    if (fields.find(f => f.id === fieldBase.id)) {
      toast.error('Este campo ya está en el diseño.')
      return
    }
    setFields([...fields, { ...fieldBase, x: 20, y: 20 } as FieldConfig])
  }

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id))
    if (selectedField === id) setSelectedField(null)
  }

  const onDrag = (e: React.MouseEvent, id: string) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const yPx = e.clientY - rect.top
    const xMm = (xPx / rect.width) * paperSize.width
    const yMm = (yPx / rect.height) * paperSize.height
    setFields(fields.map(f => f.id === id ? { ...f, x: Math.max(0, Math.min(paperSize.width, xMm)), y: Math.max(0, Math.min(paperSize.height, yMm)) } : f))
  }

  const handleSave = async () => {
    if (!companyId) return
    setSaving(true)
    try {
      const fieldsObj = fields.reduce((acc, f) => ({ ...acc, [f.id]: f }), {})
      const { error } = await supabase
        .from('companies')
        .update({ 
          remito_config: { paperSize, fields: fieldsObj, bgImage } 
        })
        .eq('id', companyId)

      if (error) throw error
      toast.success('Configuración guardada en la nube.')
    } catch (err) {
      console.error('Error guardando:', err)
      toast.error('Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Cargando Diseñador...</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/productos" className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-500">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <Settings2 className="text-blue-600" size={24} />
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Diseñador de Remitos</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-500 transition shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block tracking-widest flex items-center gap-2">
              <Layout size={14} /> 1. Formato de Hoja
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PAPER_SIZES) as Array<keyof typeof PAPER_SIZES>).map(key => (
                <button
                  key={key}
                  onClick={() => { setPaperKey(key); setPaperSize(PAPER_SIZES[key]); }}
                  className={`p-3 rounded-xl border text-[11px] font-bold transition ${
                    paperKey === key ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
            {paperKey === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 text-center">Ancho (mm)</label>
                  <input type="number" value={paperSize.width} onChange={e => setPaperSize({ ...paperSize, width: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 text-center">Alto (mm)</label>
                  <input type="number" value={paperSize.height} onChange={e => setPaperSize({ ...paperSize, height: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-bold" />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block tracking-widest flex items-center gap-2">
              <Upload size={14} /> 2. Plantilla Visual
            </label>
            <div className="relative group">
              <input type="file" onChange={handleImageUpload} className="hidden" id="bg-upload" accept="image/*" />
              <label htmlFor="bg-upload" className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                <Upload className="text-slate-400 mb-2" size={24} />
                <span className="text-[11px] font-bold text-slate-500 text-center">Cargar escaneo de remito</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block tracking-widest flex items-center gap-2">
              <Maximize2 size={14} /> 3. Arrastrar Campos
            </label>
            <div className="flex flex-col gap-2">
              {AVAILABLE_FIELDS.map(field => (
                <button
                  key={field.id}
                  disabled={fields.some(f => f.id === field.id)}
                  onClick={() => addField(field)}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 hover:border-blue-200 transition text-left disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  <span className="text-[11px] font-black text-slate-700">{field.label}</span>
                  <Move size={14} className="text-slate-300 group-hover:text-blue-500 transition" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-slate-100 p-8 overflow-auto flex items-start justify-center">
          <div 
            ref={canvasRef}
            style={{ 
              width: `${paperSize.width * 3}px`, 
              height: `${paperSize.height * 3}px`,
              backgroundImage: bgImage ? `url(${bgImage})` : 'none',
              backgroundSize: '100% 100%'
            }}
            className="relative bg-white shadow-2xl rounded-sm border border-slate-300 transition-all duration-300 overflow-hidden"
          >
            {!bgImage && (
              <div className="absolute inset-0 flex items-center justify-center text-center p-12">
                <p className="text-slate-400 text-sm font-bold opacity-40 uppercase tracking-widest">Vista previa del remito vacío</p>
              </div>
            )}

            {fields.map(field => (
              <div
                key={field.id}
                onMouseDown={() => { setSelectedField(field.id); setIsDragging(true); }}
                style={{
                  left: `${(field.x / paperSize.width) * 100}%`,
                  top: `${(field.y / paperSize.height) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute cursor-move px-2 py-1 rounded border whitespace-nowrap text-[10px] font-black transition-all group ${
                  selectedField === field.id 
                    ? 'bg-blue-600 text-white border-blue-700 z-30 shadow-lg ring-2 ring-blue-300' 
                    : 'bg-white/90 text-blue-700 border-blue-200 z-20 shadow-sm'
                }`}
              >
                {field.label}
                {selectedField === field.id && (
                  <button onMouseDown={(e) => { e.stopPropagation(); removeField(field.id); }} className="absolute -right-2 -top-2 bg-red-500 text-white p-1 rounded-full shadow-lg">
                    <Trash2 size={8} />
                  </button>
                )}
              </div>
            ))}
            
            {isDragging && (
              <div 
                className="absolute inset-0 z-50 cursor-move"
                onMouseMove={(e) => selectedField && onDrag(e, selectedField)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
