'use client'

import { useMemo, useState } from 'react'
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
  Edit2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Producto = {
  id: string
  internal_code: string | null
  name: string
  supplier: string | null
  category: string | null
  cost_price: number | null
  last_price_update: string | null
  stock_quantity: number | null
  track_stock: boolean | null
  sale_price: number | null
  show_in_catalog: boolean
}

type Props = {
  productosIniciales: Producto[]
  idEmpresa: string
  enableStockModule: boolean
}

export default function ProductosClient({ productosIniciales, idEmpresa, enableStockModule }: Props) {
  const [productos, setProductos] = useState<Producto[]>(productosIniciales)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const [mensajeError, setMensajeError] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)
  const [activeTab, setActiveTab] = useState<'venta' | 'insumo'>('venta')

  async function actualizarProductos() {
    setActualizando(true)
    setMensajeError('')
    const { data, error } = await supabase
      .from('products')
      .select('id, internal_code, name, supplier, category, cost_price, sale_price, last_price_update, stock_quantity, track_stock, show_in_catalog')
      .eq('company_id', idEmpresa)
      .eq('active', true)
      .order('name', { ascending: true })
      .range(0, 4999)
    
    if (error) setMensajeError('Error al cargar productos.')
    else setProductos(data || [])
    setActualizando(false)
  }

  const productosFiltrados = useMemo(() => {
    // Primero filtramos por la pestaña activa
    const porTipo = productos.filter(p => activeTab === 'venta' ? p.show_in_catalog : !p.show_in_catalog)
    
    const q = busqueda.toLowerCase().trim()
    if (!q) return porTipo

    return porTipo.filter((producto) => {
      return (
        producto.name?.toLowerCase().includes(q) ||
        producto.internal_code?.toLowerCase().includes(q) ||
        producto.supplier?.toLowerCase().includes(q) ||
        producto.category?.toLowerCase().includes(q)
      )
    })
  }, [productos, busqueda, activeTab])

  const ITEMS_POR_PAGINA = 50

  const productosPaginados = useMemo(() => {
    const indiceInicio = (paginaActual - 1) * ITEMS_POR_PAGINA
    return productosFiltrados.slice(indiceInicio, indiceInicio + ITEMS_POR_PAGINA)
  }, [productosFiltrados, paginaActual])

  const totalPaginas = useMemo(() => {
    return Math.ceil(productosFiltrados.length / ITEMS_POR_PAGINA)
  }, [productosFiltrados])

  const conteoProveedores = useMemo(() => {
    return new Set(
      productos.map((p) => p.supplier?.trim()).filter(Boolean)
    ).size
  }, [productos])

  const conteoCategorias = useMemo(() => {
    return new Set(
      productos.map((p) => p.category?.trim()).filter(Boolean)
    ).size
  }, [productos])

  const productosActuales = productos.filter(p => activeTab === 'venta' ? p.show_in_catalog : !p.show_in_catalog)
  const precioPromedio = useMemo(() => {
    if (productosActuales.length === 0) return 0
    const total = productosActuales.reduce((acc, p) => acc + Number(p.cost_price || 0), 0)
    return total / productosActuales.length
  }, [productosActuales])

  const productosSinPrecio = productosActuales.filter((p) => Number(p.cost_price || 0) <= 0).length

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
            <h1 className="truncate text-2xl font-black tracking-tight">Lista de productos</h1>
            <p className="mt-1 line-clamp-1 text-xs text-slate-300">Gestioná catálogo, proveedores, categorías y precios.</p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link href="/productos/nuevo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"><Plus size={16} /> Nuevo</Link>
            {enableStockModule && (
              <Link href="/inventario" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/15">
                <Boxes size={16} /> Stock
              </Link>
            )}
            <Link href="/productos/importar" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/15"><FileSpreadsheet size={16} /> Excel</Link>
            <Link href="/productos/aumentos" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/15"><ArrowUp size={16} /> Aumentos</Link>
          </div>
        </div>
      </section>

      {mensajeError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">{mensajeError}</div>}

      <section className="grid w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <TarjetaEstado titulo={activeTab === 'venta' ? "Productos" : "Insumos"} valor={productosActuales.length} icon={activeTab === 'venta' ? Package : Boxes} cargando={cargando} tono="blue" />
        <TarjetaEstado titulo="Proveedores" valor={conteoProveedores} icon={Truck} cargando={cargando} tono="green" />
        <TarjetaEstado titulo="Categorías" valor={conteoCategorias} icon={Tag} cargando={cargando} tono="slate" />
        <TarjetaEstado titulo="Promedio" valor={formatearMoneda(precioPromedio)} icon={DollarSign} cargando={cargando} tono="blue" />
        <TarjetaEstado titulo="Sin costo" valor={productosSinPrecio} icon={AlertCircle} cargando={cargando} tono={productosSinPrecio > 0 ? 'amber' : 'green'} />
      </section>

      <section className="w-full max-w-full overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-3">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button
                onClick={() => { setActiveTab('venta'); setPaginaActual(1); }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                  activeTab === 'venta' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <DollarSign size={14} /> Catálogo de Venta
              </button>
              <button
                onClick={() => { setActiveTab('insumo'); setPaginaActual(1); }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                  activeTab === 'insumo' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Boxes size={14} /> Insumos Internos
              </button>
            </div>
            
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black text-slate-950">
                  {activeTab === 'venta' ? 'Productos para clientes' : 'Suministros y Materia Prima'}
                </h2>
                <p className="text-xs text-slate-500">Buscá por nombre, código, proveedor o categoría.</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
                </div>
                <button type="button" onClick={actualizarProductos} disabled={cargando || actualizando} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                  <RefreshCw size={15} className={cargando || actualizando ? 'animate-spin' : ''} /> Actualizar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-full overflow-x-auto">
          {cargando ? <EstadoCargando /> : productosFiltrados.length === 0 ? <EstadoVacio tieneBusqueda={Boolean(busqueda.trim())} /> : (
            <div className="min-w-[900px]">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <CabeceraTabla>Producto</CabeceraTabla>
                    <CabeceraTabla>Código</CabeceraTabla>
                    <CabeceraTabla>Proveedor</CabeceraTabla>
                    <CabeceraTabla>Categoría</CabeceraTabla>
                    {enableStockModule && <CabeceraTabla alineacion="right">Stock</CabeceraTabla>}
                    <CabeceraTabla alineacion="right">P. Venta</CabeceraTabla>
                    <CabeceraTabla alineacion="right">P. Costo</CabeceraTabla>
                    <CabeceraTabla>Actualizado</CabeceraTabla>
                    <CabeceraTabla alineacion="center">Acciones</CabeceraTabla>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productosPaginados.map((producto) => (
                    <tr key={producto.id} className="h-[52px] transition hover:bg-blue-50/40">
                      <td className="min-w-0 px-4 py-2"><IdentidadProducto producto={producto} /></td>
                      <td className="min-w-0 px-4 py-2"><EtiquetaCodigo codigo={producto.internal_code} /></td>
                      <td className="min-w-0 px-4 py-2"><EtiquetaProveedor proveedor={producto.supplier} /></td>
                      <td className="min-w-0 px-4 py-2"><EtiquetaCategoria categoria={producto.category} /></td>
                      {enableStockModule && (
                        <td className="min-w-0 px-4 py-2 text-right">
                          <span className={`text-xs font-black ${Number(producto.stock_quantity || 0) <= 0 ? 'text-red-500' : 'text-slate-700'}`}>
                            {producto.track_stock ? producto.stock_quantity : '∞'}
                          </span>
                        </td>
                      )}
                      <td className="min-w-0 px-4 py-2 text-right text-sm font-black text-blue-700">
                        <span className="block truncate">{formatearMoneda(Number(producto.sale_price || producto.cost_price || 0))}</span>
                      </td>
                      <td className="min-w-0 px-4 py-2 text-right text-sm font-bold text-slate-500">
                        <span className="block truncate">{formatearMoneda(Number(producto.cost_price || 0))}</span>
                      </td>
                      <td className="min-w-0 px-4 py-2"><EtiquetaFecha fecha={producto.last_price_update} /></td>
                      <td className="min-w-0 px-4 py-2 text-center">
                        <Link 
                          href={`/productos/${producto.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-blue-600 hover:text-white"
                        >
                          <Edit2 size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                <button onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))} disabled={paginaActual === 1} className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">Anterior</button>
                <button onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))} disabled={paginaActual === totalPaginas} className="relative ml-3 inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">Siguiente</button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div><p className="text-xs text-slate-700 font-semibold">Mostrando <span className="font-black">{(paginaActual - 1) * ITEMS_POR_PAGINA + 1}</span> a <span className="font-black">{Math.min(paginaActual * ITEMS_POR_PAGINA, productosFiltrados.length)}</span> de <span className="font-black">{productosFiltrados.length}</span> resultados</p></div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm gap-1" aria-label="Paginación">
                    <button onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))} disabled={paginaActual === 1} className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
                    <span className="relative inline-flex items-center bg-white px-4 py-2 text-xs font-black text-slate-700 rounded-xl border border-slate-300">Página {paginaActual} de {totalPaginas}</span>
                    <button onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))} disabled={paginaActual === totalPaginas} className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16} /></button>
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

function IdentidadProducto({ producto }: { producto: Producto }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><Package size={17} /></div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-950">{producto.name || 'Sin nombre'}</p>
        <p className="truncate text-[11px] font-semibold text-slate-400">Producto del catálogo</p>
      </div>
    </div>
  )
}

function EtiquetaCodigo({ codigo }: { codigo: string | null }) {
  return <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700"><Hash size={12} /><span className="truncate">{codigo || 'Sin código'}</span></span>
}

function EtiquetaProveedor({ proveedor }: { proveedor: string | null }) {
  return <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700"><Truck size={12} /><span className="truncate">{proveedor || 'Sin proveedor'}</span></span>
}

function EtiquetaCategoria({ categoria }: { categoria: string | null }) {
  return <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700"><Tag size={12} /><span className="truncate">{categoria || 'Sin categoría'}</span></span>
}

function EtiquetaFecha({ fecha }: { fecha: string | null }) {
  return <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700"><CalendarDays size={13} /><span className="truncate">{fecha ? new Date(fecha).toLocaleDateString('es-AR') : 'Sin actualizar'}</span></span>
}

function TarjetaEstado({ titulo, valor, icon: Icon, cargando, tono }: { titulo: string; valor: number | string; icon: LucideIcon; cargando: boolean; tono: 'blue' | 'green' | 'slate' | 'amber' }) {
  const estilos = { blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', slate: 'bg-slate-100 text-slate-700', amber: 'bg-amber-50 text-amber-700' }
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${estilos[tono]}`}><Icon size={18} /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-slate-500">{titulo}</p>
          <h2 className="truncate text-lg font-black leading-tight text-slate-950">{cargando ? '...' : valor}</h2>
        </div>
      </div>
    </div>
  )
}

function CabeceraTabla({ children, alineacion = 'left' }: { children: ReactNode; alineacion?: 'left' | 'right' | 'center' }) {
  const alignClass = alineacion === 'right' ? 'text-right' : alineacion === 'center' ? 'text-center' : 'text-left';
  return <th className={`min-w-0 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 ${alignClass}`}><span className="block truncate">{children}</span></th>
}

function EstadoCargando() {
  return <div className="flex min-h-[320px] flex-col items-center justify-center text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Loader2 size={24} className="animate-spin" /></div><h3 className="text-base font-black text-slate-900">Cargando productos</h3><p className="mt-1 text-xs text-slate-500">Estamos consultando el catálogo registrado.</p></div>
}

function EstadoVacio({ tieneBusqueda }: { tieneBusqueda: boolean }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Boxes size={24} /></div>
      <h3 className="text-base font-black text-slate-900">No hay productos para mostrar</h3>
      <p className="mt-1 text-xs text-slate-500">{tieneBusqueda ? 'Probá cambiar la búsqueda o limpiarla.' : 'Cargá un producto nuevo o importá un Excel para empezar.'}</p>
    </div>
  )
}

function formatearMoneda(valor: number) {
  return valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}