'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getUserCompanyId } from '@/lib/getUserCompany'
import { toast } from 'sonner'
import {
  CreditCard,
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  Percent,
  MessageSquare,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'

type PaymentMethod = {
  id: string
  name: string
  active: boolean
}

type CompanyParams = {
  id: string
  payment_methods: PaymentMethod[]
  tax_rate: number | null
  default_notes: string | null
}

export default function ParametrosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [params, setParams] = useState<CompanyParams | null>(null)
  const [newMethod, setNewMethod] = useState('')

  useEffect(() => {
    loadParams()
  }, [])

  async function loadParams() {
    setLoading(true)
    const companyId = await getUserCompanyId()

    if (!companyId) {
      toast.error('No se pudo encontrar la empresa')
      router.push('/configuracion')
      return
    }

    const { data, error } = await supabase
      .from('companies')
      .select('id, payment_methods, tax_rate, default_notes')
      .eq('id', companyId)
      .single()

    if (error) {
      toast.error('Error al cargar parámetros comerciales')
      console.error(error)
    } else {
      // Ensure payment_methods is an array
      const methods = Array.isArray(data.payment_methods) 
        ? data.payment_methods 
        : [
            { id: '1', name: 'Efectivo', active: true },
            { id: '2', name: 'Transferencia', active: true },
            { id: '3', name: 'Cheque', active: true },
          ]
      
      setParams({
        ...data,
        payment_methods: methods
      })
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!params) return

    setSaving(true)
    const { error } = await supabase
      .from('companies')
      .update({
        payment_methods: params.payment_methods,
        tax_rate: params.tax_rate,
        default_notes: params.default_notes,
      })
      .eq('id', params.id)

    if (error) {
      toast.error('Error al guardar los parámetros')
      console.error(error)
    } else {
      toast.success('Parámetros actualizados correctamente')
    }
    setSaving(false)
  }

  function addPaymentMethod() {
    if (!newMethod.trim() || !params) return

    const method: PaymentMethod = {
      id: crypto.randomUUID(),
      name: newMethod.trim(),
      active: true
    }

    setParams({
      ...params,
      payment_methods: [...params.payment_methods, method]
    })
    setNewMethod('')
  }

  function removePaymentMethod(id: string) {
    if (!params) return
    setParams({
      ...params,
      payment_methods: params.payment_methods.filter(m => m.id !== id)
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  if (!params) return null

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
            <h1 className="text-2xl font-black text-slate-950">Parámetros comerciales</h1>
            <p className="text-sm font-medium text-slate-500">Configurá impuestos, métodos de pago y condiciones generales.</p>
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Metodos de Pago */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Wallet size={20} />
            </div>
            <h3 className="text-lg font-black text-slate-900">Métodos de pago</h3>
          </div>
          
          <p className="mb-6 text-sm font-medium text-slate-500">
            Definí las formas de pago que aceptás para registrar en los movimientos de cuenta corriente.
          </p>

          <div className="space-y-3">
            {params.payment_methods.map((method) => (
              <div key={method.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="text-sm font-bold text-slate-800">{method.name}</span>
                <button
                  onClick={() => removePaymentMethod(method.id)}
                  className="text-slate-400 transition hover:text-red-500"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={newMethod}
                onChange={(e) => setNewMethod(e.target.value)}
                placeholder="Ej: Mercado Pago"
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                onKeyDown={(e) => e.key === 'Enter' && addPaymentMethod()}
              />
              <button
                onClick={addPaymentMethod}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg transition hover:bg-slate-800"
              >
                <Plus size={22} />
              </button>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          {/* Impuestos */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Percent size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900">Impuestos</h3>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">IVA / Impuesto predeterminado (%)</label>
              <input
                type="number"
                value={params.tax_rate || 0}
                onChange={(e) => setParams({ ...params, tax_rate: Number(e.target.value) })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="Ej: 21"
              />
            </div>
          </section>

          {/* Notas predeterminadas */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <MessageSquare size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900">Condiciones generales</h3>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Notas al pie de presupuestos</label>
              <textarea
                value={params.default_notes || ''}
                onChange={(e) => setParams({ ...params, default_notes: e.target.value })}
                rows={4}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="Ej: Los precios están sujetos a cambio sin previo aviso..."
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
