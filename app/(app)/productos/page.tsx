'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Package,
  Search,
  RefreshCw,
  Tag,
  Truck,
  DollarSign,
  ArrowUp,
  Plus,
  FileSpreadsheet,
} from 'lucide-react'

type Product = {
  id: string
  name: string
  supplier: string | null
  cost_price: number
  last_price_update: string | null
}

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    setLoading(true)

    const { data: user } = await supabase.auth.getUser()

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.user?.id)
      .single()

    const company_id = profile?.company_id

    if (!company_id) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', company_id)
        .order('name', { ascending: true })
        .range(0, 4999)

        if (error) {
        console.log(error)
        return
        }

    if (data) setProducts(data)

    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return products

    return products.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.supplier?.toLowerCase().includes(q)
    )
  }, [products, search])

  const uniqueSuppliers = new Set(products.map(p => p.supplier)).size

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 bg-blue-500/20 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-16 h-40 w-40 bg-cyan-400/10 blur-3xl rounded-full" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <Package size={14} />
              Productos
            </div>

            <h1 className="text-3xl font-black">
              Lista de productos
            </h1>

            <p className="mt-2 text-sm text-slate-300">
              Gestioná precios, proveedores y actualizaciones.
            </p>
          </div>
            <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                    href="/productos/nuevo"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
                >
                    <Plus size={18} />
                    Nuevo producto
                </Link>

                <Link
                    href="/productos/importar"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                    <FileSpreadsheet size={18} />
                    Importar Excel
                </Link>

                <Link
                    href="/productos/aumentos"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                    <ArrowUp size={18} />
                    Aumentar precios
                </Link>
            </div>
        </div>
      </section>

      {/* STATS */}
      <section className="grid gap-4 md:grid-cols-3">
        <Stat title="Productos" value={products.length} icon={Package} loading={loading} />
        <Stat title="Proveedores" value={uniqueSuppliers} icon={Truck} loading={loading} />
        <Stat title="Promedio $" value={avg(products)} icon={DollarSign} loading={loading} />
      </section>

      {/* TABLA */}
      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:justify-between">
          <div>
            <h2 className="text-xl font-black">Listado</h2>
            <p className="text-sm text-slate-500">Buscá por producto o proveedor</p>
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-xl border bg-slate-50 focus:bg-white"
              />
            </div>

            <button
              onClick={loadProducts}
              className="flex items-center gap-2 border px-4 py-2 rounded-xl hover:bg-slate-50"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No hay productos
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-left text-xs">Producto</th>
                <th className="p-4 text-left text-xs">Proveedor</th>
                <th className="p-4 text-left text-xs">Precio</th>
                <th className="p-4 text-left text-xs">Actualizado</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t hover:bg-blue-50/30">
                  <td className="p-4 font-bold">{p.name}</td>

                  <td className="p-4">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-sm">
                      {p.supplier || 'Sin proveedor'}
                    </span>
                  </td>

                  <td className="p-4 font-bold">
                    ${p.cost_price?.toLocaleString()}
                  </td>

                  <td className="p-4 text-sm text-slate-500">
                    {p.last_price_update
                      ? new Date(p.last_price_update).toLocaleDateString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

/* COMPONENTES */

function Stat({ title, value, icon: Icon, loading }: any) {
  return (
    <div className="bg-white border p-5 rounded-3xl shadow-sm flex items-center gap-3">
      <div className="bg-blue-50 text-blue-700 p-3 rounded-xl">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <h2 className="text-xl font-black">
          {loading ? '...' : value}
        </h2>
      </div>
    </div>
  )
}

function avg(products: Product[]) {
  if (!products.length) return 0
  const total = products.reduce((acc, p) => acc + Number(p.cost_price || 0), 0)
  return Math.round(total / products.length)
}