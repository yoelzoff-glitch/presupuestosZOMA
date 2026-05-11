'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowUp,
  Boxes,
  CheckCircle2,
  Package,
  Percent,
  RefreshCw,
  Truck,
} from 'lucide-react'

type Product = {
  id: string
  company_id: string
  name: string
  supplier: string | null
  price: number
  last_price_update: string | null
}

export default function AumentoPrecios() {
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [mode, setMode] = useState<'proveedor' | 'producto'>('proveedor')
  const [supplier, setSupplier] = useState('')
  const [productId, setProductId] = useState('')
  const [percent, setPercent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const { data: user } = await supabase.auth.getUser()

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.user?.id)
      .single()

    const currentCompanyId = profile?.company_id ?? null
    setCompanyId(currentCompanyId)

    if (!currentCompanyId) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', currentCompanyId)
      .order('name', { ascending: true })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    if (data) {
      setProducts(data)

      const uniqueSuppliers = [
        ...new Set(data.map((p) => p.supplier).filter(Boolean) as string[]),
      ]

      setSuppliers(uniqueSuppliers)
    }

    setLoading(false)
  }

  const selectedProducts = useMemo(() => {
    if (mode === 'proveedor') {
      return products.filter((p) => p.supplier === supplier)
    }

    return products.filter((p) => p.id === productId)
  }, [products, mode, supplier, productId])

  const percentNumber = Number(percent)
  const multiplier = 1 + percentNumber / 100

  const preview = selectedProducts.map((p) => ({
    ...p,
    newPrice: Number(p.price || 0) * multiplier,
  }))

  async function applyIncrease() {
    const value = Number(percent)

    if (!companyId) {
      toast.error('No se encontró la empresa del usuario.')
      return
    }

    if (percent.trim() === '' || Number.isNaN(value)) {
      toast.error('Ingresá un porcentaje válido.')
      return
    }

    if (value <= -100) {
      toast.error('El porcentaje no puede ser menor o igual a -100%.')
      return
    }

    if (mode === 'proveedor' && !supplier) {
      toast.error('Seleccioná un proveedor.')
      return
    }

    if (mode === 'producto' && !productId) {
      toast.error('Seleccioná un producto.')
      return
    }

    if (selectedProducts.length === 0) {
      toast.error('No hay productos para actualizar.')
      return
    }

    setSaving(true)

    for (const p of selectedProducts) {
      const newPrice = Number(p.price || 0) * (1 + value / 100)

      const { error } = await supabase
        .from('products')
        .update({
          price: newPrice,
          last_price_update: new Date().toISOString(),
        })
        .eq('id', p.id)
        .eq('company_id', companyId)

      if (error) {
        toast.error(error.message)
        setSaving(false)
        return
      }

      await supabase.from('price_update_logs').insert({
        company_id: companyId,
        product_id: p.id,
        supplier: p.supplier,
        update_type: mode === 'proveedor' ? 'Proveedor' : 'Producto',
        percentage: value,
        old_price: p.price,
        new_price: newPrice,
      })
    }

    toast.success('Precios actualizados correctamente.')
    setSaving(false)
    setPercent('')
    await loadData()
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/productos"
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 transition hover:text-white"
            >
              <ArrowLeft size={17} />
              Volver a productos
            </Link>

            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <Percent size={14} />
              Actualización
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Aumento de precios
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Aplicá aumentos por proveedor o por producto individual, igual que en tu Excel.
            </p>
          </div>

          <button
            onClick={loadData}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
          >
            <RefreshCw size={18} />
            Actualizar datos
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat title="Productos cargados" value={products.length} icon={Package} loading={loading} />
        <Stat title="Proveedores" value={suppliers.length} icon={Truck} loading={loading} />
        <Stat title="A actualizar" value={selectedProducts.length} icon={Boxes} loading={loading} />
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-black text-slate-950">
            Configuración del aumento
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Elegí el modo, seleccioná el proveedor o producto y cargá el porcentaje.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-slate-100 p-1">
            <button
              onClick={() => {
                setMode('proveedor')
                setProductId('')
              }}
              className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                mode === 'proveedor'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Por proveedor
            </button>

            <button
              onClick={() => {
                setMode('producto')
                setSupplier('')
              }}
              className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                mode === 'producto'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Por producto
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {mode === 'proveedor' ? (
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Proveedor
                </label>
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Seleccionar proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Producto
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Seleccionar producto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
                Porcentaje
              </label>
              <div className="relative">
                <Percent
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  placeholder="Ej: 10"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <button
              onClick={applyIncrease}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowUp size={18} />
              {saving ? 'Actualizando...' : 'Aplicar aumento'}
            </button>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-xl font-black text-slate-950">
              Vista previa
            </h2>
            <p className="text-sm text-slate-500">
              Revisá los precios antes de aplicar el cambio.
            </p>
          </div>

          <div className="overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-sm font-bold text-slate-500">
                Cargando productos...
              </div>
            ) : preview.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                  <Package size={26} />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  No hay productos seleccionados
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Elegí un proveedor o producto para ver la vista previa.
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[680px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Producto
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Precio actual
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Precio nuevo
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Estado
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {preview.map((p) => (
                    <tr key={p.id} className="transition hover:bg-blue-50/40">
                      <td className="px-5 py-4">
                        <p className="font-black text-slate-950">{p.name}</p>
                        <p className="text-xs font-semibold text-slate-400">
                          {p.supplier || 'Sin proveedor'}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm font-bold text-slate-600">
                        ${Number(p.price || 0).toLocaleString('es-AR')}
                      </td>

                      <td className="px-5 py-4 text-sm font-black text-blue-700">
                        ${Number(p.newPrice || 0).toLocaleString('es-AR', {
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                          <CheckCircle2 size={14} />
                          Listo
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function Stat({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string
  value: number
  icon: any
  loading: boolean
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon size={22} />
        </div>

        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <h2 className="text-2xl font-black text-slate-950">
            {loading ? '...' : value}
          </h2>
        </div>
      </div>
    </div>
  )
}