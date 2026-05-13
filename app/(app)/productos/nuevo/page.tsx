'use client'

import { useState, useEffect } from 'react'
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
  Boxes,
} from 'lucide-react'

export default function NuevoProductoPage() {
  const [loading, setLoading] = useState(false)
  const [enableStockModule, setEnableStockModule] = useState(false)

  const [form, setForm] = useState({
    internal_code: '',
    name: '',
    supplier: '',
    category: '',
    sale_price: '',
    cost_price: '',
    stock_quantity: '0',
    track_stock: false,
    show_in_catalog: true,
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

  useEffect(() => {
    async function checkStockModule() {
      const companyId = await getCompanyId()
      if (!companyId) return
      const { data } = await supabase.from('companies').select('enable_stock_module').eq('id', companyId).single()
      setEnableStockModule(data?.enable_stock_module || false)
    }
    checkStockModule()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error('Ingresá el nombre del producto.')
      return
    }

    if (!form.sale_price.trim() || Number(form.sale_price) < 0) {
      toast.error('Ingresá un precio de venta válido.')
      return
    }

    if (enableStockModule && (!form.cost_price.trim() || Number(form.cost_price) < 0)) {
      toast.error('Ingresá un precio de costo válido.')
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
      sale_price: Number(form.sale_price),
      cost_price: Number(form.cost_price) || 0,
      stock_quantity: Number(form.stock_quantity),
      track_stock: form.track_stock,
      show_in_catalog: form.show_in_catalog,
      last_price_update: new Date().toISOString(),
    } as any)

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
      sale_price: '',
      cost_price: '',
      stock_quantity: '0',
      track_stock: false,
      show_in_catalog: true,
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
              label="Precio de Venta"
              name="sale_price"
              value={form.sale_price}
              onChange={handleChange}
              placeholder="Precio para el cliente"
              type="number"
            />

            <Field
              icon={DollarSign}
              label="Precio de Costo"
              name="cost_price"
              value={form.cost_price}
              onChange={handleChange}
              placeholder="Costo interno"
              type="number"
            />

            {enableStockModule && (
              <>
                <div className="md:col-span-2 space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Propósito del producto</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, show_in_catalog: true })}
                      className={`flex flex-col items-center gap-3 rounded-3xl border-2 p-5 transition-all ${
                        form.show_in_catalog 
                          ? 'border-blue-600 bg-blue-50/50 ring-4 ring-blue-100' 
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${form.show_in_catalog ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                        <DollarSign size={20} />
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-black ${form.show_in_catalog ? 'text-blue-900' : 'text-slate-600'}`}>Para Venta</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Visible en catálogo</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm({ ...form, show_in_catalog: false })}
                      className={`flex flex-col items-center gap-3 rounded-3xl border-2 p-5 transition-all ${
                        !form.show_in_catalog 
                          ? 'border-amber-600 bg-amber-50/50 ring-4 ring-amber-100' 
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${!form.show_in_catalog ? 'bg-amber-600 text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                        <Boxes size={20} />
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-black ${!form.show_in_catalog ? 'text-amber-900' : 'text-slate-600'}`}>Solo Insumo</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Uso interno (Recetas)</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 px-1 md:col-span-2 pt-2">
                  <input
                    type="checkbox"
                    id="track_stock"
                    checked={form.track_stock}
                    onChange={(e) => setForm({ ...form, track_stock: e.target.checked })}
                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="track_stock" className="text-sm font-black text-slate-700 cursor-pointer">
                    Habilitar control de stock e inventario
                  </label>
                </div>

                {form.track_stock && (
                  <Field
                    icon={Boxes}
                    label="Stock inicial en depósito"
                    name="stock_quantity"
                    value={form.stock_quantity}
                    onChange={handleChange}
                    placeholder="Ej: 100"
                    type="number"
                  />
                )}
              </>
            )}
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

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Precio Venta
                </p>
                <p className="mt-1 text-2xl font-black text-blue-700">
                  ${Number(form.sale_price || 0).toLocaleString('es-AR')}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Precio Costo
                </p>
                <p className="mt-1 text-xl font-black text-slate-600">
                  ${Number(form.cost_price || 0).toLocaleString('es-AR')}
                </p>
              </div>
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