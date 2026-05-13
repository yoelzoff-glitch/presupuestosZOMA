'use client'

import { useMemo, useState } from 'react'
import {
  History,
  ArrowLeft,
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
  Package,
  Calendar,
  User,
  Info,
} from 'lucide-react'
import Link from 'next/link'

type Movement = {
  id: string
  product_id: string
  type: string
  quantity: number
  reason: string
  notes: string | null
  created_at: string
  products: {
    name: string
    internal_code: string | null
  } | null
}

type Props = {
  initialMovements: Movement[]
}

export default function MovimientosClient({ initialMovements }: Props) {
  const [movements] = useState<Movement[]>(initialMovements)
  const [search, setSearch] = useState('')

  const filteredMovements = useMemo(() => {
    return movements.filter(m => 
      m.products?.name.toLowerCase().includes(search.toLowerCase()) || 
      m.products?.internal_code?.toLowerCase().includes(search.toLowerCase()) ||
      m.reason.toLowerCase().includes(search.toLowerCase())
    )
  }, [movements, search])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/inventario"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Historial de Stock</h1>
            <p className="text-sm font-bold text-slate-500">Registro detallado de ingresos, egresos y ventas.</p>
          </div>
        </div>
      </header>

      <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 p-6">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar por producto o motivo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Producto</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tipo</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Cant.</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <History size={40} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm font-bold text-slate-400">No hay movimientos registrados.</p>
                  </td>
                </tr>
              ) : (
                filteredMovements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Calendar size={14} className="text-slate-300" />
                        {new Date(m.created_at).toLocaleString('es-AR', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <Package size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 leading-tight">{m.products?.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{m.products?.internal_code || 'S/C'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {m.type === 'in' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                          <ArrowUpCircle size={12} /> Ingreso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-700">
                          <ArrowDownCircle size={12} /> Egreso
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-black ${m.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.type === 'in' ? '+' : '-'}{m.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-700">{m.reason}</span>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <p className="truncate text-xs font-medium text-slate-400" title={m.notes || ''}>
                        {m.notes || '-'}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
