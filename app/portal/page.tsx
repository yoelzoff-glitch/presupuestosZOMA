'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { fetchNextNumber } from '@/lib/fetchNextNumber'
import {
  Loader2,
  Package,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import ProductCatalog from '@/app/portal/components/ProductCatalog'
import ShoppingCartPanel from '@/app/portal/components/ShoppingCartPanel'

type Producto = {
  id: string
  internal_code: string | null
  name: string
  category: string | null
  cost_price: number | null
  active?: boolean | null
}

type UsuarioCliente = {
  id: string
  company_id: string
  client_id: string | null
  name: string
  email: string
  active: boolean
}

type ItemCarrito = {
  producto: Producto
  cantidad: number
}

export default function PortalPage() {
  const ruteador = useRouter()

  const [cliente, setCliente] = useState<UsuarioCliente | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [notas, setNotas] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mensajeError, setMensajeError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')

  useEffect(() => {
    cargarPortal()
  }, [])

  async function cargarPortal() {
    setCargando(true)
    setMensajeError('')
    setMensajeExito('')

    const { data: datosUsuario } = await supabase.auth.getUser()

    if (!datosUsuario.user) {
      ruteador.push('/auth/login')
      return
    }

    const { data: datosCliente, error: errorCliente } = await supabase
      .from('customer_users')
      .select('id, company_id, client_id, name, email, active')
      .eq('auth_user_id', datosUsuario.user.id)
      .single()

    if (errorCliente || !datosCliente) {
      setMensajeError('No se encontró el usuario cliente.')
      setCargando(false)
      return
    }

    if (!datosCliente.active) {
      setMensajeError('Tu usuario está inactivo. Contactá al administrador.')
      setCargando(false)
      return
    }

    if (!datosCliente.client_id) {
      setMensajeError(
        'Tu usuario todavía no tiene un cliente del sistema enlazado. Contactá al administrador.'
      )
      setCargando(false)
      return
    }

    setCliente(datosCliente)

    const { data: datosProductos, error: errorProductos } = await supabase
      .from('products')
      .select('id, internal_code, name, category, cost_price, active')
      .eq('company_id', datosCliente.company_id)
      .eq('active', true)
      .eq('show_in_catalog', true)
      .order('name', { ascending: true })
      .range(0, 4999)

    if (errorProductos) {
      console.error('ERROR PRODUCTOS:', errorProductos)
      setMensajeError(`Error al cargar la lista de precios: ${errorProductos.message} (${errorProductos.details || 'sin detalles'})`)
      setCargando(false)
      return
    }

    setProductos(datosProductos || [])
    setCargando(false)
  }

  // ─── Exportar Excel ─────────────────────────────────────────────────────────

  function exportarListaPrecios() {
    const filas = productos.map((p) => ({
      Código: p.internal_code || '',
      Producto: p.name || '',
      Categoría: p.category || '',
      Precio: Number(p.cost_price || 0),
    }))

    const hoja = XLSX.utils.json_to_sheet(filas)
    hoja['!cols'] = [{ wch: 18 }, { wch: 45 }, { wch: 25 }, { wch: 15 }]

    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Lista de precios')
    XLSX.writeFile(libro, 'lista-de-precios.xlsm', { bookType: 'xlsm' })
  }

  // ─── Operaciones Carrito ──────────────────────────────────────────────────

  function agregarAlCarrito(producto: Producto) {
    setMensajeError('')
    setMensajeExito('')

    setCarrito((prev) => {
      const existe = prev.find((item) => item.producto.id === producto.id)
      if (existe) {
        return prev.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      }
      return [...prev, { producto, cantidad: 1 }]
    })
  }

  function incrementarCantidad(idProducto: string) {
    setCarrito((prev) =>
      prev.map((item) =>
        item.producto.id === idProducto
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      )
    )
  }

  function decrementarCantidad(idProducto: string) {
    setCarrito((prev) =>
      prev
        .map((item) =>
          item.producto.id === idProducto
            ? { ...item, cantidad: item.cantidad - 1 }
            : item
        )
        .filter((item) => item.cantidad > 0)
    )
  }

  function quitarDelCarrito(idProducto: string) {
    setCarrito((prev) => prev.filter((item) => item.producto.id !== idProducto))
  }

  // ─── Enviar Pedido ──────────────────────────────────────────────────────────

  async function crearNotificacionPedido({
    idEmpresa,
    idPedido,
    codigoPedido,
    nombreCliente,
  }: {
    idEmpresa: string
    idPedido: string
    codigoPedido: string
    nombreCliente: string
  }) {
    const res = await fetch('/api/notifications/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: idEmpresa, orderId: idPedido, orderCode: codigoPedido, customerName: nombreCliente }),
    })
    const datos = await res.json().catch(() => null)
    if (!res.ok) {
      console.error('Error creando notificación:', datos)
      return false
    }
    return true
  }

  async function enviarPedido() {
    if (!cliente) {
      setMensajeError('No se encontró el usuario cliente.')
      return
    }

    if (!cliente.client_id) {
      setMensajeError('Tu usuario no tiene un cliente del sistema enlazado.')
      return
    }

    if (carrito.length === 0) {
      setMensajeError('Agregá al menos un producto al pedido.')
      return
    }

    const itemInvalido = carrito.find((item) => !item.cantidad || item.cantidad <= 0)
    if (itemInvalido) {
      setMensajeError('Hay productos con cantidad inválida.')
      return
    }

    setEnviando(true)
    setMensajeError('')
    setMensajeExito('')

    try {
      const proximoNumero = await fetchNextNumber('order')
      const codigoPedido = `PED-${String(proximoNumero).padStart(6, '0')}`

      // Calcular totales
      const montoTotal = carrito.reduce((acc, item) => {
        return acc + Number(item.producto.cost_price || 0) * item.cantidad
      }, 0)

      // 1. Insertar Pedido como pendiente
      const { data: datosPedido, error: errorPedido } = await supabase
        .from('orders')
        .insert({
          company_id: cliente.company_id,
          client_id: cliente.client_id,
          order_number: proximoNumero,
          order_code: codigoPedido,
          status: 'pending',
          source: 'portal',
          total_amount: montoTotal,
          notes: notas.trim() || 'Pedido enviado desde portal cliente',
        })
        .select('id')
        .single()

      if (errorPedido) throw errorPedido
      if (!datosPedido?.id) throw new Error('No se pudo crear el pedido.')

      const idPedido = datosPedido.id

      // 2. Insertar Items
      const itemsAInsertar = carrito.map((item) => ({
        company_id: cliente.company_id,
        order_id: idPedido,
        product_id: item.producto.id,
        product_code: item.producto.internal_code,
        product_name: item.producto.name,
        category: item.producto.category,
        quantity: item.cantidad,
        unit_price: Number(item.producto.cost_price || 0),
      }))

      const { error: errorItems } = await supabase
        .from('order_items')
        .insert(itemsAInsertar)

      if (errorItems) throw errorItems

      // 3. Notificación
      await crearNotificacionPedido({
        idEmpresa: cliente.company_id,
        idPedido,
        codigoPedido,
        nombreCliente: cliente.name,
      })

      setMensajeExito(`¡Pedido ${codigoPedido} enviado correctamente! Ya puedes verlo en tu historial.`)
      setCarrito([])
      setNotas('')
    } catch (error: any) {
      console.error('Error enviando pedido:', error)
      setMensajeError(`Error: ${error?.message || 'No se pudo enviar el pedido.'}`)
    } finally {
      setEnviando(false)
    }
  }

  // ─── Renderizado ──────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" size={32} />
          <p className="font-bold text-slate-700">Cargando portal...</p>
        </div>
      </div>
    )
  }

  if (mensajeError && productos.length === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-100 text-red-700">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-black text-red-900">
          No pudimos cargar el portal
        </h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-red-800">
          {mensajeError}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-200">
              <Package size={14} />
              Portal cliente
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Lista de precios
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Buscá productos, armá tu solicitud y enviala. Recibirás un presupuesto
              basado en tu selección.
            </p>
          </div>

          <button
            type="button"
            onClick={exportarListaPrecios}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
          >
            <FileSpreadsheet size={18} />
            Descargar lista
          </button>
        </div>
      </section>

      {/* Mensajes */}
      {mensajeError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {mensajeError}
        </div>
      )}
      {mensajeExito && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {mensajeExito}
        </div>
      )}

      {/* Contenido Principal */}
      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <ProductCatalog productos={productos} alAgregarAlCarrito={agregarAlCarrito} />

        <ShoppingCartPanel
          carrito={carrito}
          notas={notas}
          enviando={enviando}
          alActualizarNotas={setNotas}
          alIncrementar={incrementarCantidad}
          alDecrementar={decrementarCantidad}
          alQuitar={quitarDelCarrito}
          alEnviar={enviarPedido}
        />
      </section>
    </div>
  )
}