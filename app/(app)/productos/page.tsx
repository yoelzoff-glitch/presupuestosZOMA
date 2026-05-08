'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
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
  ChevronLeft,
  ChevronRight,
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
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

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

  const ITEMS_PER_PAGE = 50

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredProducts, currentPage])

  const totalPages = useMemo(() => {
    return Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  }, [filteredProducts])

  const suppliers = useMemo(() => {
    return new Set(
      products.map((product) => product.supplier?.trim()).filter(Boolean)
    ).size
  }, [products])

  const categories = useMemo(() => {
    return new Set(
      products.map((product) => product.category?.trim()).filter(Boolean)
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden space-y-3 pb-6">
      <section className="relative w-full max-w-full overflow-hidden rounded-[1.5rem] bg-slate-950 px-5 py-4 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-200">
              <Package size={13} />
              Productos
            </div>

            <h1 className="truncate text-2xl font-black tracking-tight">
              Lista de productos
            </h1>

            <p className="mt-1 line-clamp-1 text-xs text-slate-300">
              Gestioná catálogo, proveedores, categorías y precios.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link
              href="/productos/nuevo"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
            >
              <Plus size={16} />
              Nuevo
            </Link>

            <Link
              href="/productos/importar"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/15"
            >
              <FileSpreadsheet size={16} />
              Excel
            </Link>

            <Link
              href="/productos/aumentos"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/15"
            >
              <ArrowUp size={16} />
              Aumentos
            </Link>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="grid w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      <section className="w-full max-w-full overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-slate-950">
                Catálogo de productos
              </h2>

              <p className="text-xs text-slate-500">
                Buscá por nombre, código, proveedor o categoría.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <div className="relative w-full sm:w-72">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <button
                type="button"
                onClick={refreshProducts}
                disabled={loading || refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={15}
                  className={loading || refreshing ? 'animate-spin' : ''}
                />
                Actualizar
              </button>
            </div>
          </div>

          {search && (
            <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
              Resultado: {filteredProducts.length} producto
              {filteredProducts.length === 1 ? '' : 's'} encontrado
              {filteredProducts.length === 1 ? '' : 's'}.
            </div>
          )}
        </div>

        <div className="w-full max-w-full overflow-x-hidden">
          {loading ? (
            <LoadingState />
          ) : filteredProducts.length === 0 ? (
            <EmptyState hasSearch={Boolean(search.trim())} />
          ) : (
            <div className="w-full max-w-full overflow-x-hidden">
              <table className="w-full table-fixed">
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
                  {paginatedProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="h-[52px] transition hover:bg-blue-50/40"
                    >
                      <td className="min-w-0 px-4 py-2">
                        <ProductIdentity product={product} />
                      </td>

                      <td className="min-w-0 px-4 py-2">
                        <CodeBadge code={product.internal_code} />
                      </td>

                      <td className="min-w-0 px-4 py-2">
                        <SupplierBadge supplier={product.supplier} />
                      </td>

                      <td className="min-w-0 px-4 py-2">
                        <CategoryBadge category={product.category} />
                      </td>

                      <td className="min-w-0 px-4 py-2 text-right text-sm font-black text-blue-700">
                        <span className="block truncate">
                          {formatCurrency(Number(product.cost_price || 0))}
                        </span>
                      </td>

                      <td className="min-w-0 px-4 py-2">
                        <DateBadge date={product.last_price_update} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative ml-3 inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-slate-700 font-semibold">
                    Mostrando <span className="font-black">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a{' '}
                    <span className="font-black">
                      {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}
                    </span>{' '}
                    de <span className="font-black">{filteredProducts.length}</span> resultados
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm gap-1" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Anterior</span>
                      <ChevronLeft size={16} />
                    </button>
                    <span className="relative inline-flex items-center bg-white px-4 py-2 text-xs font-black text-slate-700 rounded-xl border border-slate-300">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Siguiente</span>
                      <ChevronRight size={16} />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function ProductIdentity({ product }: { product: Product }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
        <Package size={17} />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-950">
          {product.name || 'Sin nombre'}
        </p>

        <p className="truncate text-[11px] font-semibold text-slate-400">
          Producto del catálogo
        </p>
      </div>
    </div>
  )
}

function CodeBadge({ code }: { code: string | null }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
      <Hash size={12} />
      <span className="truncate">{code || 'Sin código'}</span>
    </span>
  )
}

function SupplierBadge({ supplier }: { supplier: string | null }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
      <Truck size={12} />
      <span className="truncate">{supplier || 'Sin proveedor'}</span>
    </span>
  )
}

function CategoryBadge({ category }: { category: string | null }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
      <Tag size={12} />
      <span className="truncate">{category || 'Sin categoría'}</span>
    </span>
  )
}

function DateBadge({ date }: { date: string | null }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
      <CalendarDays size={13} />
      <span className="truncate">
        {date ? new Date(date).toLocaleDateString('es-AR') : 'Sin actualizar'}
      </span>
    </span>
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
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles[tone]}`}
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-slate-500">{title}</p>

          <h2 className="truncate text-lg font-black leading-tight text-slate-950">
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
  children: ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`min-w-0 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 ${align === 'right' ? 'text-right' : 'text-left'
        }`}
    >
      <span className="block truncate">{children}</span>
    </th>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <Loader2 size={24} className="animate-spin" />
      </div>

      <h3 className="text-base font-black text-slate-900">
        Cargando productos
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        Estamos consultando el catálogo registrado.
      </p>
    </div>
  )
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Boxes size={24} />
      </div>

      <h3 className="text-base font-black text-slate-900">
        No hay productos para mostrar
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        {hasSearch
          ? 'Probá cambiar la búsqueda o limpiarla.'
          : 'Cargá un producto nuevo o importá un Excel para empezar.'}
      </p>

      {!hasSearch && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/productos/nuevo"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
          >
            <PackagePlus size={16} />
            Nuevo producto
          </Link>

          <Link
            href="/productos/importar"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <FileSpreadsheet size={16} />
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