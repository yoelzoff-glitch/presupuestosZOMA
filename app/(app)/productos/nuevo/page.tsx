'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  PackagePlus,
  Save,
  Tag,
  Truck,
  DollarSign,
  Layers,
  Hash,
} from 'lucide-react'

export default function NuevoProductoPage() {
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    internal_code: '',
    name: '',
    supplier: '',
    category: '',
    price: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  async function getCompanyId() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) return null

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()

    return profile?.company_id ?? null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error('Ingresá el nombre del producto.')
      return
    }

    if (!form.price.trim() || Number(form.price) < 0) {
      toast.error('Ingresá un precio válido.')
      return
    }

    setLoading(true)

    const companyId = await getCompanyId()

    if (!companyId) {
      toast.error('No se encontró la empresa del usuario.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('products').insert({
      company_id: companyId,
      internal_code: form.internal_code.trim() || null,
      name: form.name.trim(),
      supplier: form.supplier.trim() || null,
      category: form.category.trim() || null,
      cost_price: Number(form.price),
      last_price_update: new Date().toISOString(),
    })

    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Producto creado correctamente.')

    setForm({
      internal_code: '',
      name: '',
      supplier: '',
      category: '',
      price: '',
    })
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10">
          <Link
            href="/productos"
            className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 transition hover:text-white"
          >
            <ArrowLeft size={17} />
            Volver a productos
          </Link>

          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
            <PackagePlus size={14} />
            Nuevo producto
          </div>

          <h1 className="text-3xl font-black tracking-tight">
            Cargar producto
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Registrá productos con proveedor, categoría y precio para usarlos en presupuestos.
          </p>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 lg:grid-cols-5"
      >
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3">
          <h2 className="text-xl font-black text-slate-950">
            Datos del producto
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Completá la información principal del producto.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field
              icon={Hash}
              label="Código interno"
              name="internal_code"
              value={form.internal_code}
              onChange={handleChange}
              placeholder="Ej: 001"
            />

            <Field
              icon={Truck}
              label="Proveedor"
              name="supplier"
              value={form.supplier}
              onChange={handleChange}
              placeholder="Ej: Acme"
            />

            <div className="md:col-span-2">
              <Field
                icon={Tag}
                label="Nombre del producto"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Ej: Cable bipolar 2x1"
              />
            </div>

            <Field
              icon={Layers}
              label="Categoría"
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="Ej: Electricidad"
            />

            <Field
              icon={DollarSign}
              label="Precio costo"
              name="price"
              value={form.price}
              onChange={handleChange}
              placeholder="Ej: 2500"
              type="number"
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={18} />
              {loading ? 'Guardando...' : 'Guardar producto'}
            </button>

            <Link
              href="/productos"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </Link>
          </div>
        </section>

        <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <PackagePlus size={24} />
          </div>

          <h3 className="mt-5 text-xl font-black text-slate-950">
            Vista previa
          </h3>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
              Producto
            </p>

            <h4 className="mt-2 text-2xl font-black text-slate-950">
              {form.name || 'Sin nombre'}
            </h4>

            <div className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
              <p>Proveedor: {form.supplier || 'Sin proveedor'}</p>
              <p>Categoría: {form.category || 'Sin categoría'}</p>
              <p>Código: {form.internal_code || 'Sin código'}</p>
            </div>

            <div className="mt-5 rounded-2xl bg-white p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Precio costo
              </p>
              <p className="mt-1 text-2xl font-black text-blue-700">
                ${Number(form.price || 0).toLocaleString('es-AR')}
              </p>
            </div>
          </div>
        </aside>
      </form>
    </div>
  )
}

function Field({
  icon: Icon,
  label,
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  icon: any
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      <div className="relative">
        <Icon
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
      </div>
    </div>
  )
}