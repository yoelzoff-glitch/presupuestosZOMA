'use client'

import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Send,
  Loader2,
  ClipboardList,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatCurrency'

type Producto = {
  id: string
  internal_code: string | null
  name: string
  category: string | null
  cost_price: number | null
}

type ItemCarrito = {
  producto: Producto
  cantidad: number
}

type Props = {
  carrito: ItemCarrito[]
  notas: string
  enviando: boolean
  alActualizarNotas: (notas: string) => void
  alIncrementar: (idProducto: string) => void
  alDecrementar: (idProducto: string) => void
  alQuitar: (idProducto: string) => void
  alEnviar: () => void
}

export default function ShoppingCartPanel({
  carrito,
  notas,
  enviando,
  alActualizarNotas,
  alIncrementar,
  alDecrementar,
  alQuitar,
  alEnviar,
}: Props) {
  const totalCarrito = carrito.reduce((acc, item) => {
    return acc + Number(item.producto.cost_price || 0) * item.cantidad
  }, 0)

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
            <ClipboardList size={22} className="text-blue-600" />
            Tu Solicitud
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {carrito.length} producto{carrito.length === 1 ? '' : 's'} seleccionado
            {carrito.length === 1 ? '' : 's'}.
          </p>
        </div>

        {carrito.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
              <ShoppingCart size={26} />
            </div>
            <h3 className="font-black text-slate-900">Solicitud vacía</h3>
            <p className="mt-1 text-sm text-slate-500">
              Agregá productos para enviar tu solicitud.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {carrito.map((item) => (
              <div key={item.producto.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">
                      {item.producto.name}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {item.producto.internal_code || '-'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => alQuitar(item.producto.id)}
                    className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                    aria-label="Quitar producto"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => alDecrementar(item.producto.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="min-w-10 text-center font-black text-slate-950">
                      {item.cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => alIncrementar(item.producto.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  <p className="font-black text-blue-700">
                    {formatCurrency(
                      Number(item.producto.cost_price || 0) * item.cantidad
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-200 p-5">
          <label className="mb-2 block text-sm font-black text-slate-700">
            Notas
          </label>
          <textarea
            value={notas}
            onChange={(e) => alActualizarNotas(e.target.value)}
            placeholder="Ej: entregar la semana próxima..."
            rows={3}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />

          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm font-black uppercase tracking-widest text-slate-400">
              Total ref.
            </p>
            <p className="text-2xl font-black text-slate-950">
              {formatCurrency(totalCarrito)}
            </p>
          </div>

          <button
            type="button"
            onClick={alEnviar}
            disabled={enviando || carrito.length === 0}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
            {enviando ? 'Enviando...' : 'Enviar solicitud de presupuesto'}
          </button>

          <p className="mt-3 text-center text-xs font-semibold text-slate-400">
            La solicitud ingresará como pendiente. El presupuesto lo genera la empresa.
          </p>
        </div>
      </section>
    </aside>
  )
}
