'use client'

import { useState, useMemo, useEffect } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Package,
  Search,
  RefreshCw,
  Truck,
  DollarSign,
  Plus,
  FileSpreadsheet,
  Hash,
  Tag,
  CalendarDays,
  Loader2,
  Boxes,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Settings2,
  ArrowUpRight,
  Info,
  CheckCircle,
  HelpCircle,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/formatCurrency'

type Producto = {
  id: string
  internal_code: string | null
  name: string
  supplier: string | null
  category: string | null
  cost_price: number | null
  sale_price: number | null
  last_price_update: string | null
}

type Purchase = {
  id: string
  product_id: string
  product_name: string
  product_code: string | null
  supplier: string | null
  supplier_id: string | null
  quantity: number
  unit_cost: number
  total_cost: number
  previous_cost: number
  cost_variation: number
  purchase_date: string
  provider_invoice: string | null
  payment_method: string | null
  payment_status: 'paid' | 'pending'
  amount_paid: number
  notes: string | null
  created_at: string
}

type Supplier = {
  id: string
  company_id: string
  name: string
  cuit: string | null
  phone: string | null
  email: string | null
  created_at: string
}

type SupplierPayment = {
  id: string
  company_id: string
  supplier_id: string
  purchase_id: string | null
  amount: number
  payment_date: string
  payment_method: string | null
  description: string | null
  user_id: string | null
  created_at: string
}

type SupplierBalance = {
  supplier: string
  supplier_id: string
  total_purchased: number
  total_paid: number
  balance_due: number
  purchase_count: number
}

type Props = {
  productosIniciales: Producto[]
  comprasIniciales: Purchase[]
  proveedoresIniciales: Supplier[]
  pagosProveedoresIniciales: SupplierPayment[]
  idEmpresa: string
}

export default function ComprasClient({
  productosIniciales,
  idEmpresa,
  comprasIniciales,
  proveedoresIniciales,
  pagosProveedoresIniciales,
}: Props) {
  const [productos, setProductos] = useState<Producto[]>(productosIniciales)
  const [compras, setCompras] = useState<Purchase[]>(comprasIniciales)
  const [proveedores, setProveedores] = useState<Supplier[]>(proveedoresIniciales)
  const [pagosProveedores, setPagosProveedores] = useState<SupplierPayment[]>(pagosProveedoresIniciales)
  
  // Estados para la calculadora/formulario
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  
  const [cantidad, setCantidad] = useState('1')
  const [costoUnitario, setCostoUnitario] = useState('0')
  const [proveedor, setProveedor] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [fechaCompra, setFechaCompra] = useState(new Date().toISOString().split('T')[0])
  const [facturaProveedor, setFacturaProveedor] = useState('')
  const [medioPago, setMedioPago] = useState('Transferencia')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid')
  const [amountPaid, setAmountPaid] = useState('')
  const [observaciones, setObservaciones] = useState('')

  // Opciones de precio de venta sugerido
  const [actualizarPrecioVenta, setActualizarPrecioVenta] = useState(false)
  const [precioVentaNuevo, setPrecioVentaNuevo] = useState('0')
  
  // Estados UI / Pestañas
  const [pestanaActiva, setPestanaActiva] = useState<'historial' | 'deudas'>('historial')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)

  // Estados para Modal Crear Proveedor
  const [mostrandoFormProveedor, setMostrandoFormProveedor] = useState(false)
  const [guardandoProveedor, setGuardandoProveedor] = useState(false)
  const [nuevoProveedorNombre, setNuevoProveedorNombre] = useState('')
  const [nuevoProveedorCuit, setNuevoProveedorCuit] = useState('')
  const [nuevoProveedorPhone, setNuevoProveedorPhone] = useState('')
  const [nuevoProveedorEmail, setNuevoProveedorEmail] = useState('')

  // Estados para Modal Registrar Pago
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<SupplierBalance | null>(null)
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoMetodo, setPagoMetodo] = useState('Transferencia')
  const [pagoFecha, setPagoFecha] = useState(new Date().toISOString().split('T')[0])
  const [pagoDescripcion, setPagoDescripcion] = useState('Pago de deuda')
  const [pagoPurchaseId, setPagoPurchaseId] = useState('')
  const [guardandoPago, setGuardandoPago] = useState(false)
  
  // Cargar perfil del usuario para auditoría
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    async function getSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getSession()
  }, [])

  // Productos filtrados para el selector autocomplete
  const productosFiltradosSelector = useMemo(() => {
    const q = busquedaProducto.toLowerCase().trim()
    if (!q) return productos.slice(0, 10)
    return productos.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.internal_code && p.internal_code.toLowerCase().includes(q))
    ).slice(0, 10)
  }, [productos, busquedaProducto])

  // Lógica de recomendación de precio de venta en tiempo real
  const precioVentaRecomendado = useMemo(() => {
    if (!productoSeleccionado) return 0
    const costoAnterior = productoSeleccionado.cost_price || 0
    const ventaAnterior = productoSeleccionado.sale_price || 0
    const costoNuevo = Number(costoUnitario) || 0
    
    if (costoAnterior > 0) {
      // Mantiene el mismo margen/markup original
      const markup = ventaAnterior / costoAnterior
      return Number((costoNuevo * markup).toFixed(2))
    }
    // Si no tenía costo anterior, asume un margen por defecto del 40%
    return Number((costoNuevo * 1.40).toFixed(2))
  }, [productoSeleccionado, costoUnitario])

  // Actualizar precio de venta recomendado en el input cuando cambia el costo unitario
  useEffect(() => {
    if (productoSeleccionado) {
      setPrecioVentaNuevo(String(precioVentaRecomendado))
    }
  }, [precioVentaRecomendado, productoSeleccionado])

  // Manejar selección de producto
  function handleSeleccionarProducto(prod: Producto) {
    setProductoSeleccionado(prod)
    setBusquedaProducto(prod.name)
    setCostoUnitario(String(prod.cost_price || 0))
    setProveedor(prod.supplier || '')
    setMostrarDropdown(false)
    setActualizarPrecioVenta(false)
  }

  // Cálculos de simulación en tiempo real
  const totalSimulado = useMemo(() => {
    const qty = Number(cantidad) || 0
    const cost = Number(costoUnitario) || 0
    return qty * cost
  }, [cantidad, costoUnitario])

  const variacionCostoSimulada = useMemo(() => {
    if (!productoSeleccionado) return 0
    const costoAnterior = productoSeleccionado.cost_price || 0
    const costoNuevo = Number(costoUnitario) || 0
    if (costoAnterior <= 0) return 0
    return Number((((costoNuevo - costoAnterior) / costoAnterior) * 100).toFixed(2))
  }, [productoSeleccionado, costoUnitario])

  // Limpiar simulador
  function limpiarSimulador() {
    setProductoSeleccionado(null)
    setBusquedaProducto('')
    setCantidad('1')
    setCostoUnitario('0')
    setProveedor('')
    setSupplierId('')
    setFechaCompra(new Date().toISOString().split('T')[0])
    setFacturaProveedor('')
    setMedioPago('Transferencia')
    setPaymentStatus('paid')
    setAmountPaid('')
    setObservaciones('')
    setActualizarPrecioVenta(false)
  }

  // Cargar compras/historial actualizado
  async function actualizarHistorial() {
    setCargandoHistorial(true)
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('company_id', idEmpresa)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, 999)

    if (error) {
      toast.error('Error al actualizar el historial.')
    } else {
      setCompras(data || [])
    }
    setCargandoHistorial(false)
  }

  // Recargar proveedores y pagos a proveedores
  async function recargarPagosYProveedores() {
    const { data: provs } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', idEmpresa)
      .order('name', { ascending: true })
    if (provs) setProveedores(provs)

    const { data: pgs } = await supabase
      .from('supplier_payments')
      .select('*')
      .eq('company_id', idEmpresa)
      .order('payment_date', { ascending: false })
    if (pgs) setPagosProveedores(pgs)
  }

  // Confirmar y Guardar la compra
  async function guardarCompra() {
    if (!productoSeleccionado) return
    setGuardando(true)
    setMostrarConfirmacion(false)

    try {
      const nuevoCostoNum = Number(costoUnitario) || 0
      const nuevoVentaNum = Number(precioVentaNuevo) || 0
      const cantidadNum = Number(cantidad) || 0
      const totalCompra = cantidadNum * nuevoCostoNum
      const pagadoActual = paymentStatus === 'paid' ? totalCompra : (Number(amountPaid) || 0)

      // 1. Registrar compra en el historial
      const { error: purchaseErr } = await supabase
        .from('purchases')
        .insert({
          company_id: idEmpresa,
          product_id: productoSeleccionado.id,
          user_id: userId,
          product_name: productoSeleccionado.name,
          product_code: productoSeleccionado.internal_code,
          supplier: proveedor || null,
          supplier_id: supplierId || null,
          quantity: cantidadNum,
          unit_cost: nuevoCostoNum,
          previous_cost: productoSeleccionado.cost_price || 0,
          purchase_date: fechaCompra,
          provider_invoice: facturaProveedor || null,
          payment_method: medioPago || null,
          payment_status: paymentStatus,
          amount_paid: pagadoActual,
          notes: observaciones || null
        })

      if (purchaseErr) throw purchaseErr

      // 2. Actualizar producto (cost_price y opcionalmente sale_price)
      const camposActualizar: any = {
        cost_price: nuevoCostoNum,
        last_price_update: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if (actualizarPrecioVenta) {
        camposActualizar.sale_price = nuevoVentaNum
      }

      const { error: productErr } = await supabase
        .from('products')
        .update(camposActualizar)
        .eq('id', productoSeleccionado.id)

      if (productErr) throw productErr

      toast.success('Compra guardada y costo del producto actualizado.')
      
      // Actualizar localmente la lista de productos
      setProductos(prev => prev.map(p => {
        if (p.id === productoSeleccionado.id) {
          return {
            ...p,
            cost_price: nuevoCostoNum,
            sale_price: actualizarPrecioVenta ? nuevoVentaNum : p.sale_price,
            last_price_update: camposActualizar.last_price_update
          }
        }
        return p
      }))

      // Resetear simulador y recargar historial
      limpiarSimulador()
      await actualizarHistorial()
      await recargarPagosYProveedores()

    } catch (err: any) {
      toast.error('Error al guardar compra: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  // ─── LÓGICA DE PROVEEDORES Y DEUDAS ────────────────────────────────────────

  // Crear nuevo proveedor en la base de datos
  async function handleCrearProveedor() {
    if (!nuevoProveedorNombre.trim()) return
    setGuardandoProveedor(true)
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          company_id: idEmpresa,
          name: nuevoProveedorNombre.trim(),
          cuit: nuevoProveedorCuit.trim() || null,
          phone: nuevoProveedorPhone.trim() || null,
          email: nuevoProveedorEmail.trim() || null
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Proveedor registrado correctamente.')
      setProveedores(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSupplierId(data.id)
      setProveedor(data.name)
      // resetear form
      setNuevoProveedorNombre('')
      setNuevoProveedorCuit('')
      setNuevoProveedorPhone('')
      setNuevoProveedorEmail('')
      setMostrandoFormProveedor(false)
    } catch (err: any) {
      toast.error('Error al registrar proveedor: ' + err.message)
    } finally {
      setGuardandoProveedor(false)
    }
  }

  // Calcular balances agrupados por proveedor
  const balancesProveedores = useMemo<SupplierBalance[]>(() => {
    const balances: Record<string, SupplierBalance> = {}

    // Inicializar todos los proveedores
    proveedores.forEach(p => {
      balances[p.id] = {
        supplier: p.name,
        supplier_id: p.id,
        total_purchased: 0,
        total_paid: 0,
        balance_due: 0,
        purchase_count: 0
      }
    })

    // Sumar compras históricas
    compras.forEach(c => {
      if (c.supplier_id && balances[c.supplier_id]) {
        const total = c.total_cost || 0
        const paid = c.amount_paid || 0
        balances[c.supplier_id].total_purchased += total
        balances[c.supplier_id].total_paid += paid
        balances[c.supplier_id].balance_due += (total - paid)
        balances[c.supplier_id].purchase_count += 1
      }
    })

    // Restar pagos realizados
    pagosProveedores.forEach(sp => {
      if (sp.supplier_id && balances[sp.supplier_id]) {
        balances[sp.supplier_id].total_paid += sp.amount
        balances[sp.supplier_id].balance_due -= sp.amount
      }
    })

    // Solo devolver proveedores con compras o deudas registradas
    return Object.values(balances)
  }, [proveedores, compras, pagosProveedores])

  // Filtrar balances por búsqueda de texto
  const balancesFiltrados = useMemo(() => {
    const q = filtroProveedor.toLowerCase().trim()
    if (!q) return balancesProveedores
    return balancesProveedores.filter(b => b.supplier.toLowerCase().includes(q))
  }, [balancesProveedores, filtroProveedor])

  // Obtener compras pendientes de pago para el proveedor seleccionado en el modal
  const comprasPendientesProveedor = useMemo(() => {
    if (!selectedSupplierForPayment) return []
    return compras.filter(c => 
      c.supplier_id === selectedSupplierForPayment.supplier_id && 
      c.payment_status === 'pending'
    )
  }, [compras, selectedSupplierForPayment])

  // Registrar un pago y liquidar deudas (con imputación FIFO si es "a cuenta")
  async function registrarPagoProveedor() {
    if (!selectedSupplierForPayment || !pagoMonto) return
    const montoNum = Number(pagoMonto)
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingresá un monto válido.')
      return
    }

    setGuardandoPago(true)
    try {
      // 1. Registrar el pago en supplier_payments
      const { error: spErr } = await supabase
        .from('supplier_payments')
        .insert({
          company_id: idEmpresa,
          supplier_id: selectedSupplierForPayment.supplier_id,
          purchase_id: pagoPurchaseId || null,
          amount: montoNum,
          payment_date: pagoFecha,
          payment_method: pagoMetodo,
          description: pagoDescripcion || 'Pago de deuda',
          user_id: userId
        })

      if (spErr) throw spErr

      // 2. Imputar pago a compras pendientes
      if (pagoPurchaseId) {
        // Imputación directa a una compra específica
        const compra = compras.find(c => c.id === pagoPurchaseId)
        if (compra) {
          const nuevoMontoPagado = (compra.amount_paid || 0) + montoNum
          const nuevoEstado = nuevoMontoPagado >= (compra.total_cost || 0) ? 'paid' : 'pending'
          
          const { error: purchaseUpdErr } = await supabase
            .from('purchases')
            .update({
              amount_paid: nuevoMontoPagado,
              payment_status: nuevoEstado
            })
            .eq('id', pagoPurchaseId)
            
          if (purchaseUpdErr) throw purchaseUpdErr
        }
      } else {
        // Imputación automática FIFO (el pago se distribuye de las compras pendientes más antiguas a las más recientes)
        let remanente = montoNum
        const pendientes = compras
          .filter(c => c.supplier_id === selectedSupplierForPayment.supplier_id && c.payment_status === 'pending')
          .sort((a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime())

        for (const c of pendientes) {
          if (remanente <= 0) break
          const pendienteCompra = (c.total_cost || 0) - (c.amount_paid || 0)
          const abonar = Math.min(remanente, pendienteCompra)
          const nuevoMontoPagado = (c.amount_paid || 0) + abonar
          const nuevoEstado = nuevoMontoPagado >= (c.total_cost || 0) ? 'paid' : 'pending'

          const { error: purchaseUpdErr } = await supabase
            .from('purchases')
            .update({
              amount_paid: nuevoMontoPagado,
              payment_status: nuevoEstado
            })
            .eq('id', c.id)

          if (purchaseUpdErr) throw purchaseUpdErr
          remanente -= abonar
        }
      }

      toast.success('Pago registrado correctamente y deudas imputadas.')
      setSelectedSupplierForPayment(null)
      setPagoMonto('')
      setPagoPurchaseId('')
      setPagoDescripcion('Pago de deuda')
      
      await actualizarHistorial()
      await recargarPagosYProveedores()
    } catch (err: any) {
      toast.error('Error al registrar el pago: ' + err.message)
    } finally {
      setGuardandoPago(false)
    }
  }

  // Filtrado de historial
  const comprasFiltradas = useMemo(() => {
    const q = filtroBusqueda.toLowerCase().trim()
    if (!q) return compras

    return compras.filter(c => 
      c.product_name.toLowerCase().includes(q) ||
      (c.product_code && c.product_code.toLowerCase().includes(q)) ||
      (c.supplier && c.supplier.toLowerCase().includes(q)) ||
      (c.provider_invoice && c.provider_invoice.toLowerCase().includes(q))
    )
  }, [compras, filtroBusqueda])

  // Paginación
  const ITEMS_POR_PAGINA = 15
  const comprasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA
    return comprasFiltradas.slice(inicio, inicio + ITEMS_POR_PAGINA)
  }, [comprasFiltradas, paginaActual])

  const totalPaginas = useMemo(() => {
    return Math.ceil(comprasFiltradas.length / ITEMS_POR_PAGINA)
  }, [comprasFiltradas])

  // Métricas
  const metricas = useMemo(() => {
    const totalGasto = compras.reduce((acc, c) => acc + (c.total_cost || 0), 0)
    const cantTransacciones = compras.length
    
    // Obtener producto con más compras
    const contadorProductos: Record<string, { nombre: string; cant: number }> = {}
    compras.forEach(c => {
      if (!contadorProductos[c.product_id]) {
        contadorProductos[c.product_id] = { nombre: c.product_name, cant: 0 }
      }
      contadorProductos[c.product_id].cant += c.quantity
    })
    
    let masComprado = 'Ninguno'
    let maxCantidad = 0
    Object.values(contadorProductos).forEach(val => {
      if (val.cant > maxCantidad) {
        maxCantidad = val.cant
        masComprado = val.nombre
      }
    })

    // Variación promedio
    const comprasConVariacion = compras.filter(c => c.previous_cost > 0)
    const sumVariacion = comprasConVariacion.reduce((acc, c) => acc + c.cost_variation, 0)
    const varPromedio = comprasConVariacion.length > 0 ? (sumVariacion / comprasConVariacion.length) : 0

    return {
      totalGasto,
      cantTransacciones,
      masComprado,
      varPromedio
    }
  }, [compras])

  // Exportar Excel Estético usando formato HTML (abre directo en Excel sin errores de tipo y con estilos premium)
  function exportarAExcel() {
    if (compras.length === 0) {
      toast.error('No hay registros para exportar.')
      return
    }

    let filasHtml = ''
    compras.forEach((c, index) => {
      const claseZebra = index % 2 === 0 ? '' : 'class="bg-zebra"'
      const claseVar = c.cost_variation > 0 ? 'class="var-up text-right"' : c.cost_variation < 0 ? 'class="var-down text-right"' : 'class="var-zero text-right"'
      
      const signoVar = c.cost_variation > 0 ? '+' : ''
      const textoVar = c.previous_cost > 0 ? `${signoVar}${c.cost_variation}%` : 'Nuevo Costo'

      filasHtml += `
        <tr ${claseZebra}>
          <td class="text-center">${new Date(c.purchase_date).toLocaleDateString('es-AR')}</td>
          <td>${c.product_name}</td>
          <td class="text-center">${c.product_code || '-'}</td>
          <td>${c.supplier || '-'}</td>
          <td class="text-right">${c.quantity}</td>
          <td class="text-right">$${c.unit_cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          <td class="text-right">$${c.total_cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          <td class="text-right">${c.previous_cost > 0 ? `$${c.previous_cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}</td>
          <td ${claseVar}>${textoVar}</td>
          <td class="text-center">${c.provider_invoice || '-'}</td>
          <td>${c.payment_method || '-'}</td>
        </tr>
      `
    })

    const totalGastado = compras.reduce((acc, c) => acc + c.total_cost, 0)
    const totalCantidad = compras.reduce((acc, c) => acc + c.quantity, 0)

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Historial de Compras</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; }
          th { background-color: #1e40af; color: #ffffff; font-weight: bold; text-transform: uppercase; border: 1px solid #cbd5e1; padding: 10px; font-size: 9pt; height: 35px; }
          td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: middle; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .bg-title { background-color: #0f172a; color: #ffffff; font-size: 16pt; font-weight: bold; text-align: center; height: 45px; }
          .bg-subtitle { background-color: #1e293b; color: #cbd5e1; font-size: 11pt; text-align: center; height: 30px; }
          .bg-header-row { height: 35px; }
          .bg-zebra { background-color: #f8fafc; }
          .bg-total { background-color: #dbeafe; font-weight: bold; height: 35px; color: #1e3a8a; }
          .var-up { color: #dc2626; font-weight: bold; }
          .var-down { color: #16a34a; font-weight: bold; }
          .var-zero { color: #64748b; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="11" class="bg-title">REPORTE DE COMPRAS Y REABASTECIMIENTO</td></tr>
          <tr><td colspan="11" class="bg-subtitle">Generado el: ${new Date().toLocaleDateString('es-AR')} | Total Transacciones: ${compras.length}</td></tr>
          <tr><td colspan="11" style="height: 15px; border: none;"></td></tr>
          <tr class="bg-header-row">
            <th>Fecha</th>
            <th>Producto</th>
            <th>Código</th>
            <th>Proveedor</th>
            <th class="text-right">Cantidad</th>
            <th class="text-right">Costo Unitario</th>
            <th class="text-right">Total</th>
            <th class="text-right">Costo Anterior</th>
            <th class="text-center">Variación</th>
            <th>Comprobante</th>
            <th>Medio de Pago</th>
          </tr>
          ${filasHtml}
          <tr class="bg-total">
            <td colspan="4" style="border-top: 2px solid #1e40af;">TOTALES</td>
            <td class="text-right" style="border-top: 2px solid #1e40af;">${totalCantidad}</td>
            <td class="text-right" style="border-top: 2px solid #1e40af;">-</td>
            <td class="text-right" style="border-top: 2px solid #1e40af;">$${totalGastado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td colspan="4" style="border-top: 2px solid #1e40af;"></td>
          </tr>
        </table>
      </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `historial-compras-${new Date().toISOString().split('T')[0]}.xls`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Excel exportado correctamente.')
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden space-y-6 pb-12">
      
      {/* 1. HERO HEADER */}
      <section className="relative w-full max-w-full overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-16 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-200">
              <Boxes size={13} />
              Reabastecimiento
            </div>
            <h1 className="truncate text-3xl font-black tracking-tight font-sans">
              Compras e Historial de Costos
            </h1>
            <p className="mt-1 line-clamp-1 text-sm text-slate-350 font-sans">
              Calculá en tiempo real tu gasto de abastecimiento y registrá la evolución de precios.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              onClick={exportarAExcel}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 cursor-pointer"
            >
              <FileSpreadsheet size={16} /> Exportar Historial
            </button>
            <button
              onClick={actualizarHistorial}
              disabled={cargandoHistorial}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/15"
            >
              <RefreshCw size={15} className={cargandoHistorial ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>
        </div>
      </section>

      {/* 2. GRID PRINCIPAL (FORMULARIO / SIMULADOR + INFO) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* PANEL DE CALCULADORA / SIMULADOR */}
        <section className="lg:col-span-2 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Settings2 size={20} className="text-blue-600" />
              Calculadora & Registro de Compra
            </h2>
            {productoSeleccionado && (
              <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 animate-pulse">
                Modo Simulación Activo
              </span>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            
            {/* Buscador de Producto */}
            <div className="relative space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Seleccionar Producto
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o código..."
                  value={busquedaProducto}
                  onChange={(e) => {
                    setBusquedaProducto(e.target.value)
                    setMostrarDropdown(true)
                  }}
                  onFocus={() => setMostrarDropdown(true)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>

              {mostrarDropdown && (
                <div className="absolute left-0 right-0 z-25 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {productosFiltradosSelector.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500 font-bold text-center">
                      No se encontraron productos activos.
                    </div>
                  ) : (
                    productosFiltradosSelector.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSeleccionarProducto(p)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition border-b border-slate-100 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold truncate">
                            {p.supplier ? `Proveedor: ${p.supplier}` : 'Sin proveedor'}
                          </p>
                        </div>
                        <div className="text-right pl-4">
                          <p className="text-xs font-black text-blue-700">
                            Costo: {formatCurrency(p.cost_price || 0)}
                          </p>
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                            <Hash size={10} /> {p.internal_code || 'S/C'}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Proveedor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Proveedor de la Compra
                </label>
                <button
                  type="button"
                  onClick={() => setMostrandoFormProveedor(true)}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-500 flex items-center gap-1"
                >
                  <Plus size={10} /> Nuevo Proveedor
                </button>
              </div>
              <div className="relative">
                <Truck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={supplierId}
                  onChange={(e) => {
                    const id = e.target.value
                    setSupplierId(id)
                    const prov = proveedores.find(p => p.id === id)
                    setProveedor(prov ? prov.name : '')
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white appearance-none"
                >
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.cuit ? `(CUIT: ${p.cuit})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cantidad a comprar */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Cantidad a comprar
              </label>
              <div className="relative">
                <Boxes size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm font-black outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Precio Unitario Costo */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Precio Unitario de Compra ($)
              </label>
              <div className="relative">
                <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm font-black outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Fecha de compra */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Fecha de Compra
              </label>
              <div className="relative">
                <CalendarDays size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={fechaCompra}
                  onChange={(e) => setFechaCompra(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Factura / Remito proveedor */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                N° Factura / Remito Proveedor
              </label>
              <div className="relative">
                <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ej: FM-0001-00012345"
                  value={facturaProveedor}
                  onChange={(e) => setFacturaProveedor(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Medio de pago */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Medio de Pago
              </label>
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia Bancaria</option>
                <option value="Cheque">Cheque</option>
                <option value="MercadoPago">MercadoPago</option>
                <option value="Cuenta Corriente">A Cuenta / Crédito</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            {/* Estado de Pago */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Estado de Pago
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => {
                  const val = e.target.value as 'paid' | 'pending'
                  setPaymentStatus(val)
                  if (val === 'paid') {
                    setAmountPaid('')
                  } else {
                    setAmountPaid('0')
                  }
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="paid">Pagado Completo</option>
                <option value="pending">Pendiente / Cuenta Corriente</option>
              </select>
            </div>

            {/* Monto Abonado Inicial */}
            {paymentStatus === 'pending' && (
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Monto Abonado Inicial ($)
                </label>
                <div className="relative">
                  <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    max={totalSimulado}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="Monto pagado al iniciar..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm font-black outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>
            )}

            {/* Observaciones */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Observaciones / Notas
              </label>
              <textarea
                placeholder="Ingresá notas internas sobre esta compra..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full h-20 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>
            
          </div>

          {/* OPCIONES RECOMENDADAS PARA EL PRECIO DE VENTA */}
          {productoSeleccionado && (
            <div className="mt-4 p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={actualizarPrecioVenta}
                  onChange={(e) => setActualizarPrecioVenta(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-350 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-xs font-black text-slate-900">
                    Actualizar también el Precio de Venta en catálogo
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500">
                    Módulo recomendado para mantener los márgenes comerciales de forma ágil.
                  </p>
                </div>
              </label>

              {actualizarPrecioVenta && (
                <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-blue-100">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Margen Original Estimado
                    </p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">
                      {productoSeleccionado.cost_price && productoSeleccionado.cost_price > 0
                        ? `${(((productoSeleccionado.sale_price || 0) / productoSeleccionado.cost_price - 1) * 100).toFixed(1)}%`
                        : 'No registrado'}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-700 uppercase tracking-wider block">
                      Precio de Venta Sugerido / Editar ($)
                    </label>
                    <div className="relative">
                      <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={precioVentaNuevo}
                        onChange={(e) => setPrecioVentaNuevo(e.target.value)}
                        className="w-full rounded-xl border border-blue-200 bg-white pl-8 pr-3 py-1.5 text-xs font-black text-blue-750 outline-none focus:border-blue-500"
                      />
                    </div>
                    <span className="text-[9px] font-semibold text-slate-400">
                      Recomendación sugerida: {formatCurrency(precioVentaRecomendado)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BOTONES DE ACCIÓN DE CALCULADORA */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 justify-end">
            <button
              type="button"
              onClick={limpiarSimulador}
              className="px-5 py-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-black transition hover:bg-slate-200 cursor-pointer"
            >
              Limpiar
            </button>
            <button
              type="button"
              disabled={!productoSeleccionado || Number(cantidad) <= 0 || Number(costoUnitario) < 0}
              onClick={() => setMostrarConfirmacion(true)}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white text-xs font-black transition hover:bg-blue-500 shadow-md shadow-blue-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Guardar Compra
            </button>
          </div>
        </section>

        {/* COLUMNA DERECHA: RESULTADOS EN TIEMPO REAL / METRICAS */}
        <aside className="space-y-6">
          
          {/* CARD DE RESULTADOS DE SIMULACIÓN */}
          <section className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
            <h3 className="text-lg font-black mb-4 relative z-10 flex items-center gap-2">
              <ArrowUpRight size={20} className="text-cyan-400" />
              Vista de Simulación
            </h3>

            {productoSeleccionado ? (
              <div className="space-y-5 relative z-10">
                
                {/* Total de Gasto */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-450">
                    Total Estimado
                  </p>
                  <p className="text-3xl font-mono font-bold tracking-tight text-white mt-1">
                    {formatCurrency(totalSimulado)}
                  </p>
                </div>

                {/* Info del Producto */}
                <div className="pt-4 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">Producto</span>
                    <span className="text-white font-bold truncate max-w-[150px]" title={productoSeleccionado.name}>
                      {productoSeleccionado.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">Costo Anterior</span>
                    <span className="text-slate-200">
                      {formatCurrency(productoSeleccionado.cost_price || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">Costo Nuevo</span>
                    <span className="text-slate-200">
                      {formatCurrency(Number(costoUnitario) || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">Variación</span>
                    <span className={`font-black ${
                      variacionCostoSimulada > 0 ? 'text-red-400' : variacionCostoSimulada < 0 ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                      {variacionCostoSimulada > 0 ? '+' : ''}
                      {variacionCostoSimulada}%
                    </span>
                  </div>
                </div>

                {actualizarPrecioVenta && (
                  <div className="pt-3 border-t border-white/10 space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-blue-400">Precio Venta Anterior</span>
                      <span className="text-slate-350">{formatCurrency(productoSeleccionado.sale_price || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-blue-400">Precio Venta Nuevo</span>
                      <span className="text-white font-black">{formatCurrency(Number(precioVentaNuevo) || 0)}</span>
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-white/[0.05] p-3 text-[11px] text-slate-400 leading-relaxed">
                  💡 <b>Modo Simulación:</b> Los cambios y valores que ves en esta caja negra no se guardarán hasta que hagas clic en "Guardar Compra" y confirmes.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-3">
                <Info size={32} className="text-slate-500" />
                <p className="text-xs font-bold max-w-xs text-balance">
                  Seleccioná un producto del buscador para comenzar la simulación y ver los indicadores en tiempo real.
                </p>
              </div>
            )}
          </section>

          {/* METRICAS DE COMPRA */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              Resumen del Historial
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-xs font-bold text-slate-500">Total Gastado</span>
                <span className="text-xs font-black text-slate-900">{formatCurrency(metricas.totalGasto)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-xs font-bold text-slate-500">Transacciones</span>
                <span className="text-xs font-black text-slate-900">{metricas.cantTransacciones}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-xs font-bold text-slate-500">Var. Costo Promedio</span>
                <span className={`text-xs font-black ${
                  metricas.varPromedio > 0 ? 'text-red-650' : metricas.varPromedio < 0 ? 'text-emerald-650' : 'text-slate-500'
                }`}>
                  {metricas.varPromedio > 0 ? '+' : ''}{metricas.varPromedio.toFixed(2)}%
                </span>
              </div>
              <div className="flex flex-col p-3 rounded-xl bg-slate-50 gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Más reabastecido</span>
                <span className="text-xs font-black text-slate-800 truncate" title={metricas.masComprado}>
                  {metricas.masComprado}
                </span>
              </div>
            </div>
          </section>

        </aside>
      </div>

      {/* 3. SELECCIÓN DE PESTAÑAS (HISTORIAL VS DEUDAS PROVEEDORES) */}
      <div className="flex border-b border-slate-200 gap-6 mt-4">
        <button
          onClick={() => setPestanaActiva('historial')}
          className={`pb-3 text-sm font-bold border-b-2 transition outline-none cursor-pointer ${
            pestanaActiva === 'historial'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Historial de Compras
        </button>
        <button
          onClick={() => setPestanaActiva('deudas')}
          className={`pb-3 text-sm font-bold border-b-2 transition outline-none cursor-pointer ${
            pestanaActiva === 'deudas'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Deudas con Proveedores
        </button>
      </div>

      {pestanaActiva === 'historial' ? (
        /* HISTORIAL DE COMPRAS REGISTRADAS (TABLA) */
        <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
          
          {/* Cabecera del Historial */}
          <div className="border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Historial de Actualizaciones de Costo
              </h2>
              <p className="text-xs text-slate-500">
                Evolución de costos a lo largo del tiempo de reabastecimiento.
              </p>
            </div>
            
            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={filtroBusqueda}
                onChange={(e) => {
                  setFiltroBusqueda(e.target.value)
                  setPaginaActual(1)
                }}
                placeholder="Buscar por producto, proveedor, factura..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Tabla */}
          <div className="w-full max-w-full overflow-x-auto">
            {comprasFiltradas.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center text-center p-6">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <Boxes size={24} />
                </div>
                <h3 className="text-sm font-black text-slate-900">No se encontraron registros</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">
                  Registrá una compra en el simulador o cambiá la búsqueda del historial.
                </p>
              </div>
            ) : (
              <div className="min-w-[1000px]">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <CabeceraTabla>Fecha</CabeceraTabla>
                      <CabeceraTabla>Producto</CabeceraTabla>
                      <CabeceraTabla>Código</CabeceraTabla>
                      <CabeceraTabla>Proveedor</CabeceraTabla>
                      <CabeceraTabla alineacion="right">Cant.</CabeceraTabla>
                      <CabeceraTabla alineacion="right">Costo Unitario</CabeceraTabla>
                      <CabeceraTabla alineacion="right">Total</CabeceraTabla>
                      <CabeceraTabla alineacion="right">Costo Ant.</CabeceraTabla>
                      <CabeceraTabla alineacion="center">Variación</CabeceraTabla>
                      <CabeceraTabla alineacion="center">Estado</CabeceraTabla>
                      <CabeceraTabla>Comprobante</CabeceraTabla>
                      <CabeceraTabla>Detalle</CabeceraTabla>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comprasPaginadas.map((compra) => {
                      const sign = compra.cost_variation > 0 ? '+' : ''
                      const isNewCost = compra.previous_cost <= 0
                      
                      return (
                        <tr key={compra.id} className="h-12 transition hover:bg-blue-50/40 text-xs text-slate-700">
                          <td className="px-4 py-2 font-semibold">
                            {new Date(compra.purchase_date).toLocaleDateString('es-AR')}
                          </td>
                          <td className="px-4 py-2 font-bold text-slate-900">
                            {compra.product_name}
                          </td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-650">
                              {compra.product_code || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-2 max-w-[130px] truncate" title={compra.supplier || ''}>
                            {compra.supplier || '-'}
                          </td>
                          <td className="px-4 py-2 text-right font-black">
                            {compra.quantity}
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-slate-900">
                            {formatCurrency(compra.unit_cost)}
                          </td>
                          <td className="px-4 py-2 text-right font-black text-slate-950">
                            {formatCurrency(compra.total_cost)}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-400">
                            {isNewCost ? '-' : formatCurrency(compra.previous_cost)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {isNewCost ? (
                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                                Inicial
                              </span>
                            ) : (
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${
                                compra.cost_variation > 0 ? 'bg-red-50 text-red-600' : compra.cost_variation < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {sign}{compra.cost_variation}%
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black leading-none ${
                              compra.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {compra.payment_status === 'paid' ? 'Pagado' : `Debe ${formatCurrency((compra.total_cost || 0) - (compra.amount_paid || 0))}`}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-semibold max-w-[120px] truncate" title={compra.provider_invoice || ''}>
                            {compra.provider_invoice || '-'}
                          </td>
                          <td className="px-4 py-2 max-w-[150px] truncate text-slate-400 italic" title={compra.notes || ''}>
                            {compra.notes || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                  disabled={paginaActual === 1}
                  className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                  disabled={paginaActual === totalPaginas}
                  className="relative ml-3 inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-slate-700 font-semibold">
                    Mostrando <span className="font-black">{(paginaActual - 1) * ITEMS_POR_PAGINA + 1}</span> a <span className="font-black">{Math.min(paginaActual * ITEMS_POR_PAGINA, comprasFiltradas.length)}</span> de <span className="font-black">{comprasFiltradas.length}</span> registros
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm gap-1" aria-label="Paginación">
                    <button
                      onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                      disabled={paginaActual === 1}
                      className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="relative inline-flex items-center bg-white px-4 py-2 text-xs font-black text-slate-700 rounded-xl border border-slate-300">
                      Página {paginaActual} de {totalPaginas}
                    </span>
                    <button
                      onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                      disabled={paginaActual === totalPaginas}
                      className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        /* SALDOS Y DEUDAS POR PROVEEDOR */
        <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm animate-in fade-in duration-200">
          
          {/* Cabecera de Deudas */}
          <div className="border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Saldos y Deudas por Proveedor
              </h2>
              <p className="text-xs text-slate-500">
                Resumen de importes adeudados y registro de pagos a cuenta.
              </p>
            </div>
            
            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={filtroProveedor}
                onChange={(e) => setFiltroProveedor(e.target.value)}
                placeholder="Buscar proveedor..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Tabla de Proveedores */}
          <div className="w-full max-w-full overflow-x-auto">
            {balancesFiltrados.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center text-center p-6">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <Truck size={24} />
                </div>
                <h3 className="text-sm font-black text-slate-900">No hay deudas registradas</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">
                  No se encontraron proveedores o no hay compras cargadas.
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <CabeceraTabla>Proveedor</CabeceraTabla>
                    <CabeceraTabla alineacion="center">Compras Realizadas</CabeceraTabla>
                    <CabeceraTabla alineacion="right">Total Comprado</CabeceraTabla>
                    <CabeceraTabla alineacion="right">Total Pagado</CabeceraTabla>
                    <CabeceraTabla alineacion="right">Saldo Adeudado</CabeceraTabla>
                    <CabeceraTabla alineacion="center">Acciones</CabeceraTabla>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balancesFiltrados.map((bal) => (
                    <tr key={bal.supplier_id} className="h-12 transition hover:bg-blue-50/40 text-xs text-slate-700">
                      <td className="px-4 py-2 font-bold text-slate-900">
                        {bal.supplier}
                      </td>
                      <td className="px-4 py-2 text-center font-black">
                        {bal.purchase_count}
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-slate-900">
                        {formatCurrency(bal.total_purchased)}
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-emerald-700">
                        {formatCurrency(bal.total_paid)}
                      </td>
                      <td className={`px-4 py-2 text-right font-black ${bal.balance_due > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                        {formatCurrency(bal.balance_due)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSupplierForPayment(bal)
                            setPagoMonto(String(bal.balance_due > 0 ? bal.balance_due : ''))
                          }}
                          className="rounded-lg bg-blue-50 px-3 py-1.5 text-[10px] font-black text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                        >
                          Registrar Pago
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* 4. MODAL DE CONFIRMACIÓN AL GUARDAR */}
      {mostrarConfirmacion && productoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in zoom-in-95 duration-200 rounded-[2.5rem] border border-white/10 bg-white p-8 shadow-2xl lg:p-10">
            
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-950 flex items-center gap-2">
                <HelpCircle className="text-blue-600" size={24} />
                Confirmar Compra
              </h3>
            </div>

            <div className="space-y-6">
              
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Producto:</span>
                  <span className="font-black text-slate-900">{productoSeleccionado.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cantidad:</span>
                  <span className="font-black text-slate-900">{cantidad} unidades</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Compra:</span>
                  <span className="font-black text-slate-950">{formatCurrency(totalSimulado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estado de Pago:</span>
                  <span className={`font-black ${paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {paymentStatus === 'paid' ? 'Pagado Completo' : `Pendiente (Abonado inicial: ${formatCurrency(Number(amountPaid) || 0)})`}
                  </span>
                </div>
              </div>

              {/* Advertencias de Actualización */}
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                  <p className="text-slate-600">
                    Se actualizará el costo del producto de{' '}
                    <span className="font-bold">{formatCurrency(productoSeleccionado.cost_price || 0)}</span> a{' '}
                    <span className="font-black text-slate-900">{formatCurrency(Number(costoUnitario) || 0)}</span>
                    {' '}({variacionCostoSimulada > 0 ? '+' : ''}{variacionCostoSimulada}%).
                  </p>
                </div>

                {actualizarPrecioVenta && (
                  <div className="flex items-start gap-2.5 text-xs">
                    <CheckCircle className="text-blue-600 shrink-0 mt-0.5" size={16} />
                    <p className="text-slate-600">
                      Se actualizará el precio de venta en catálogo de{' '}
                      <span className="font-bold">{formatCurrency(productoSeleccionado.sale_price || 0)}</span> a{' '}
                      <span className="font-black text-slate-900">{formatCurrency(Number(precioVentaNuevo) || 0)}</span>.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMostrarConfirmacion(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-3 text-xs font-black text-slate-600 hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={guardarCompra}
                  className="flex-1 rounded-xl bg-blue-600 py-3 text-xs font-black text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2"
                >
                  {guardando ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Procesando...
                    </>
                  ) : (
                    'Confirmar y Guardar'
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR PROVEEDOR */}
      {mostrandoFormProveedor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Truck size={20} className="text-blue-600" />
                Registrar Nuevo Proveedor
              </h3>
              <button
                onClick={() => setMostrandoFormProveedor(false)}
                className="rounded-lg p-1 text-slate-450 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Nombre / Razón Social *</label>
                <input
                  type="text"
                  placeholder="Ej: Distribuidora Zoma"
                  value={nuevoProveedorNombre}
                  onChange={(e) => setNuevoProveedorNombre(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">CUIT (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: 30-12345678-9"
                  value={nuevoProveedorCuit}
                  onChange={(e) => setNuevoProveedorCuit(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="Ej: 1122334455"
                    value={nuevoProveedorPhone}
                    onChange={(e) => setNuevoProveedorPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Ej: ventas@distri.com"
                    value={nuevoProveedorEmail}
                    onChange={(e) => setNuevoProveedorEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
              <button
                onClick={() => setMostrandoFormProveedor(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearProveedor}
                disabled={guardandoProveedor || !nuevoProveedorNombre.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                {guardandoProveedor ? <Loader2 className="animate-spin" size={14} /> : null}
                Guardar Proveedor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PAGO A PROVEEDOR */}
      {selectedSupplierForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[2.5rem] bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-black text-slate-900 flex flex-col">
                <span className="flex items-center gap-2">
                  <DollarSign size={20} className="text-emerald-600" />
                  Registrar Pago de Deuda
                </span>
                <span className="text-xs text-slate-450 mt-1 font-semibold">
                  Proveedor: {selectedSupplierForPayment.supplier}
                </span>
              </h3>
              <button
                onClick={() => setSelectedSupplierForPayment(null)}
                className="rounded-lg p-1 text-slate-450 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Saldo Adeudado Actual:</span>
                <span className="text-sm font-black text-red-600">{formatCurrency(selectedSupplierForPayment.balance_due)}</span>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Monto a pagar ($) *</label>
                <div className="relative">
                  <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" />
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="Monto..."
                    value={pagoMonto}
                    onChange={(e) => setPagoMonto(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-2 text-sm font-black outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Imputar a compra específica (opcional)</label>
                <select
                  value={pagoPurchaseId}
                  onChange={(e) => setPagoPurchaseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                >
                  <option value="">A Cuenta / Prorrateo Automático (FIFO)</option>
                  {comprasPendientesProveedor.map(c => {
                    const pendiente = (c.total_cost || 0) - (c.amount_paid || 0)
                    return (
                      <option key={c.id} value={c.id}>
                        {new Date(c.purchase_date).toLocaleDateString('es-AR')} - {c.product_name} (Pendiente: {formatCurrency(pendiente)})
                      </option>
                    )
                  })}
                </select>
                <p className="text-[9px] text-slate-400 mt-1 leading-normal">
                  * Si seleccionás "Prorrateo Automático", el pago se imputará de forma FIFO (primero a las compras más antiguas).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Fecha de Pago</label>
                  <input
                    type="date"
                    value={pagoFecha}
                    onChange={(e) => setPagoFecha(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Medio de Pago</label>
                  <select
                    value={pagoMetodo}
                    onChange={(e) => setPagoMetodo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Cheque">Cheque</option>
                    <option value="MercadoPago">MercadoPago</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Descripción / Notas</label>
                <input
                  type="text"
                  placeholder="Ej: Pago parcial de deudas"
                  value={pagoDescripcion}
                  onChange={(e) => setPagoDescripcion(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                />
              </div>

            </div>

            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedSupplierForPayment(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={registrarPagoProveedor}
                disabled={guardandoPago || !pagoMonto}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                {guardandoPago ? <Loader2 className="animate-spin" size={14} /> : null}
                Registrar Pago
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function CabeceraTabla({ children, alineacion = 'left' }: { children: ReactNode; alineacion?: 'left' | 'right' | 'center' }) {
  const alignClass = alineacion === 'right' ? 'text-right' : alineacion === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 ${alignClass}`}>
      <span className="block truncate">{children}</span>
    </th>
  )
}
