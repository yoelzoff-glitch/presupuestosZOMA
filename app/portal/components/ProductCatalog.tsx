'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  Plus,
  Package,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatCurrency'

type Producto = {
  id: string
  internal_code: string | null
  name: string
  category: string | null
  price: number | null
}

type Props = {
  productos: Producto[]
  alAgregarAlCarrito: (producto: Producto) => void
}

const PRODUCTOS_POR_PAGINA = 12

export default function ProductCatalog({ productos, alAgregarAlCarrito }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)

  const productosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return productos
    return productos.filter((p) => {
      return (
        p.name?.toLowerCase().includes(q) ||
        p.internal_code?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      )
    })
  }, [productos, busqueda])

  const totalPaginas = Math.ceil(productosFiltrados.length / PRODUCTOS_POR_PAGINA)
  const productosPaginados = productosFiltrados.slice(
    (paginaActual - 1) * PRODUCTOS_POR_PAGINA,
    paginaActual * PRODUCTOS_POR_PAGINA
  )

  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPaginaActual(1)
            }}
            placeholder="Buscar producto, código o categoría..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {productosPaginados.map((producto) => (
          <article
            key={producto.id}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Package size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="line-clamp-2 font-black text-slate-950">
                  {producto.name}
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  Código: {producto.internal_code || '-'}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Precio de referencia
              </p>
              <p className="mt-1 text-2xl font-black text-blue-700">
                {formatCurrency(Number(producto.price || 0))}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {producto.category || 'Sin categoría'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => alAgregarAlCarrito(producto)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
            >
              <Plus size={18} />
              Agregar
            </button>
          </article>
        ))}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
            disabled={paginaActual === 1}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft size={16} />
            Anterior
          </button>
          <span className="text-xs font-black text-slate-700">
            Página {paginaActual} de {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
            disabled={paginaActual === totalPaginas}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Siguiente
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {productosFiltrados.length === 0 && (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
            <Package size={26} />
          </div>
          <h3 className="text-lg font-black text-slate-900">
            No encontramos productos
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Probá cambiar la búsqueda.
          </p>
        </div>
      )}
    </div>
  )
}
