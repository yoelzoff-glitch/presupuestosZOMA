'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Package,
  Search,
  RefreshCw,
  Truck,
  DollarSign,
  ArrowUp,
  Plus,
  FileSpreadsheet,
  Hash,
  Tag,
  CalendarDays,
  Loader2,
  Boxes,
  PackagePlus,
  AlertCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Product = {
  id: string
  internal_code: string | null
  name: string
  supplier: string | null
  category: string | null
  cost_price: number | null
  last_price_update: string | null
}

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  async function getCompanyId() {
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) return null

    const { data: profile, error: profileError } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()

    if (profileError || !profile?.company_id) return null

    return profile.company_id as string
  }

  async function loadProducts() {
    setErrorMsg('')
    setLoading(true)

    const companyId = await getCompanyId()

    if (!companyId) {
      setProducts([])
      setErrorMsg('No se encontró la empresa del usuario.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('products')
      .select(
        'id, internal_code, name, supplier, category, cost_price, last_price_update'
      )
      .eq('company_id', companyId)
      .order('name', { ascending: true })
      .range(0, 4999)

    if (error) {
      setProducts([])
      setErrorMsg('Error al cargar productos.')
      setLoading(false)
      return
    }

    setProducts(data || [])
    setLoading(false)
  }

  async function refreshProducts() {
    setRefreshing(true)
    await loadProducts()
    setRefreshing(false)
  }

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim()

    if (!q) return products

    return products.filter((product) => {
      return (
        product.name?.toLowerCase().includes(q) ||
        product.internal_code?.toLowerCase().includes(q) ||
        product.supplier?.toLowerCase().includes(q) ||
        product.category?.toLowerCase().includes(q)
      )
    })
  }, [products, search])

  const suppliers = useMemo(() => {
    return new Set(
      products
        .map((product) => product.supplier?.trim())
        .filter(Boolean)
    ).size
  }, [products])

  const categories = useMemo(() => {
    return new Set(
      products
        .map((product) => product.category?.trim())
        .filter(Boolean)
    ).size
  }, [products])

  const averagePrice = useMemo(() => {
    if (products.length === 0) return 0

    const total = products.reduce(
      (acc, product) => acc + Number(product.cost_price || 0),
      0
    )

    return total / products.length
  }, [products])

  const productsWithoutPrice = products.filter(
    (product) => Number(product.cost_price || 0) <= 0
  ).length

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <Package size={14} />
              Productos
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Lista de productos
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Gestioná el catálogo de productos, proveedores, categorías y
              precios para armar presupuestos.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:justify-end">
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

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Productos"
          value={products.length}
          icon={Package}
          loading={loading}
          tone="blue"
        />

        <StatCard
          title="Proveedores"
          value={suppliers}
          icon={Truck}
          loading={loading}
          tone="green"
        />

        <StatCard
          title="Categorías"
          value={categories}
          icon={Tag}
          loading={loading}
          tone="slate"
        />

        <StatCard
          title="Promedio"
          value={formatCurrency(averagePrice)}
          icon={DollarSign}
          loading={loading}
          tone="blue"
        />

        <StatCard
          title="Sin precio"
          value={productsWithoutPrice}
          icon={AlertCircle}
          loading={loading}
          tone={productsWithoutPrice > 0 ? 'amber' : 'green'}
        />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-slate-200 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Catálogo de productos
              </h2>

              <p className="text-sm text-slate-500">
                Buscá por nombre, código, proveedor o categoría.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:w-80"
                />
              </div>

              <button
                type="button"
                onClick={refreshProducts}
                disabled={loading || refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={loading || refreshing ? 'animate-spin' : ''}
                />
                Actualizar
              </button>
            </div>
          </div>

          {search && (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              Resultado: {filteredProducts.length} producto
              {filteredProducts.length === 1 ? '' : 's'} encontrado
              {filteredProducts.length === 1 ? '' : 's'}.
            </div>
          )}
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredProducts.length === 0 ? (
          <EmptyState hasSearch={Boolean(search.trim())} />
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHead>Producto</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead align="right">Precio costo</TableHead>
                    <TableHead>Actualizado</TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="transition hover:bg-blue-50/40"
                    >
                      <td className="px-5 py-4">
                        <ProductIdentity product={product} />
                      </td>

                      <td className="px-5 py-4">
                        <CodeBadge code={product.internal_code} />
                      </td>

                      <td className="px-5 py-4">
                        <SupplierBadge supplier={product.supplier} />
                      </td>

                      <td className="px-5 py-4">
                        <CategoryBadge category={product.category} />
                      </td>

                      <td className="px-5 py-4 text-right text-lg font-black text-blue-700">
                        {formatCurrency(Number(product.cost_price || 0))}
                      </td>

                      <td className="px-5 py-4">
                        <DateBadge date={product.last_price_update} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 xl:hidden">
              {filteredProducts.map((product) => (
                <ProductMobileCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function ProductMobileCard({ product }: { product: Product }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <ProductIdentity product={product} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniData label="Código" value={product.internal_code || '-'} />
        <MiniData label="Proveedor" value={product.supplier || 'Sin proveedor'} />
        <MiniData label="Categoría" value={product.category || 'Sin categoría'} />
        <MiniData
          label="Precio costo"
          value={formatCurrency(Number(product.cost_price || 0))}
        />
      </div>

      <div className="mt-4">
        <DateBadge date={product.last_price_update} />
      </div>
    </article>
  )
}

function ProductIdentity({ product }: { product: Product }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
        <Package size={20} />
      </div>

      <div className="min-w-0">
        <p className="truncate font-black text-slate-950">
          {product.name || 'Sin nombre'}
        </p>

        <p className="text-xs font-semibold text-slate-400">
          Producto del catálogo
        </p>
      </div>
    </div>
  )
}

function CodeBadge({ code }: { code: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
      <Hash size={14} />
      {code || 'Sin código'}
    </span>
  )
}

function SupplierBadge({ supplier }: { supplier: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
      <Truck size={14} />
      {supplier || 'Sin proveedor'}
    </span>
  )
}

function CategoryBadge({ category }: { category: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
      <Tag size={14} />
      {category || 'Sin categoría'}
    </span>
  )
}

function DateBadge({ date }: { date: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
      <CalendarDays size={15} />
      {date ? new Date(date).toLocaleDateString('es-AR') : 'Sin actualizar'}
    </span>
  )
}

function MiniData({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>

      <p className="mt-1 font-black text-slate-900">{value}</p>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  tone,
}: {
  title: string
  value: number | string
  icon: LucideIcon
  loading: boolean
  tone: 'blue' | 'green' | 'slate' | 'amber'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles[tone]}`}
        >
          <Icon size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-500">
            {title}
          </p>

          <h2 className="truncate text-[22px] font-black leading-tight text-slate-950">
            {loading ? '...' : value}
          </h2>
        </div>
      </div>
    </div>
  )
}

function TableHead({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
        <Loader2 size={26} className="animate-spin" />
      </div>

      <h3 className="text-lg font-black text-slate-900">
        Cargando productos
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Estamos consultando el catálogo registrado.
      </p>
    </div>
  )
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
        <Boxes size={26} />
      </div>

      <h3 className="text-lg font-black text-slate-900">
        No hay productos para mostrar
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {hasSearch
          ? 'Probá cambiar la búsqueda o limpiarla.'
          : 'Cargá un producto nuevo o importá un Excel para empezar.'}
      </p>

      {!hasSearch && (
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/productos/nuevo"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
          >
            <PackagePlus size={18} />
            Nuevo producto
          </Link>

          <Link
            href="/productos/importar"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <FileSpreadsheet size={18} />
            Importar Excel
          </Link>
        </div>
      )}
    </div>
  )
}

function formatCurrency(value: number) {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}