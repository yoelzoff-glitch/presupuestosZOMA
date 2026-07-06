'use client'

import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/formatCurrency'
import {
  Landmark,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Package,
  Hash,
  Tag,
  CalendarDays,
  Boxes,
  AlertCircle,
  Info,
  CheckCircle,
  HelpCircle,
  X,
  CreditCard,
  Calendar,
  Filter,
  BookOpen,
} from 'lucide-react'
import RecordTypeSelector from '@/app/components/RecordTypeSelector'
import type { LucideIcon } from 'lucide-react'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type TreasurySummary = {
  company_id: string
  total_cash_in: number
  total_cash_out: number
  net_cash_flow: number
  total_client_debt: number
  total_supplier_debt: number
  net_balance: number
}

type LedgerEntry = {
  id: string
  company_id: string
  entry_date: string
  entry_type: 'ingreso' | 'egreso'
  concept: string
  amount: number
  payment_method: string | null
  created_at: string
  source_table: string
  source_id: string
}

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
  record_type?: 'blanco' | 'x'
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
  record_type?: 'blanco' | 'x'
}

type SupplierBalance = {
  supplier: string
  supplier_id: string
  total_purchased: number
  total_paid: number
  balance_due: number
  purchase_count: number
}

type ClientBalance = {
  client_id: string
  company_id: string
  client_name: string
  cuit: string | null
  total_debit: number
  total_credit: number
  balance_due: number
}

type TabId = 'dashboard' | 'compras' | 'proveedores' | 'clientes'

type Props = {
  idEmpresa: string
  treasurySummary: TreasurySummary | null
  ledgerEntries: LedgerEntry[]
  productosIniciales: Producto[]
  comprasIniciales: Purchase[]
  proveedoresIniciales: Supplier[]
  pagosProveedoresIniciales: SupplierPayment[]
  clientBalancesIniciales: ClientBalance[]
  paymentMethods: string[]
}

// ─── TABS CONFIG ──────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'compras', label: 'Compras', icon: ShoppingCart },
  { id: 'proveedores', label: 'Proveedores', icon: Truck },
  { id: 'clientes', label: 'Clientes', icon: Users },
]

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function TesoreriaClient({
  idEmpresa,
  treasurySummary: initialSummary,
  ledgerEntries: initialLedger,
  productosIniciales,
  comprasIniciales,
  proveedoresIniciales,
  pagosProveedoresIniciales,
  clientBalancesIniciales,
  paymentMethods,
}: Props) {
  // ── Global state ──
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [summary, setSummary] = useState<TreasurySummary | null>(initialSummary)
  const [ledger, setLedger] = useState<LedgerEntry[]>(initialLedger)
  const [productos, setProductos] = useState<Producto[]>(productosIniciales)
  const [compras, setCompras] = useState<Purchase[]>(comprasIniciales)
  const [proveedores, setProveedores] = useState<Supplier[]>(proveedoresIniciales)
  const [pagosProveedores, setPagosProveedores] = useState<SupplierPayment[]>(pagosProveedoresIniciales)
  const [clientBalances, setClientBalances] = useState<ClientBalance[]>(clientBalancesIniciales)
  const [recordType, setRecordType] = useState<'blanco' | 'x'>('blanco')

  // ── Auth ──
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    async function getSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getSession()
  }, [])

  // ── Dashboard state ──
  const [dashboardCargando, setDashboardCargando] = useState(false)
  const [ledgerFiltroBusqueda, setLedgerFiltroBusqueda] = useState('')
  const [ledgerFiltroTipo, setLedgerFiltroTipo] = useState<'todos' | 'ingreso' | 'egreso'>('todos')
  const [ledgerFiltroRango, setLedgerFiltroRango] = useState<'30' | '90' | '365' | 'todos'>('30')
  const [ledgerPagina, setLedgerPagina] = useState(1)

  // ── Compras state ──
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
  const [actualizarPrecioVenta, setActualizarPrecioVenta] = useState(false)
  const [precioVentaNuevo, setPrecioVentaNuevo] = useState('0')
  const [guardando, setGuardando] = useState(false)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [filtroBusquedaCompras, setFiltroBusquedaCompras] = useState('')
  const [paginaCompras, setPaginaCompras] = useState(1)
  const [mostrandoFormProveedor, setMostrandoFormProveedor] = useState(false)
  const [guardandoProveedor, setGuardandoProveedor] = useState(false)
  const [nuevoProveedorNombre, setNuevoProveedorNombre] = useState('')
  const [nuevoProveedorCuit, setNuevoProveedorCuit] = useState('')
  const [nuevoProveedorPhone, setNuevoProveedorPhone] = useState('')
  const [nuevoProveedorEmail, setNuevoProveedorEmail] = useState('')

  // ── Proveedores state ──
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<SupplierBalance | null>(null)
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoMetodo, setPagoMetodo] = useState('Transferencia')
  const [pagoFecha, setPagoFecha] = useState(new Date().toISOString().split('T')[0])
  const [pagoDescripcion, setPagoDescripcion] = useState('Pago de deuda')
  const [pagoPurchaseId, setPagoPurchaseId] = useState('')
  const [guardandoPago, setGuardandoPago] = useState(false)

  // ── Clientes state ──
  const [filtroCliente, setFiltroCliente] = useState('')
  const [selectedClientForPayment, setSelectedClientForPayment] = useState<ClientBalance | null>(null)
  const [cobroMonto, setCobroMonto] = useState('')
  const [cobroMetodo, setCobroMetodo] = useState(paymentMethods[0] || 'Transferencia')
  const [cobroDescripcion, setCobroDescripcion] = useState('Pago recibido')
  const [guardandoCobro, setGuardandoCobro] = useState(false)

  // ══════════════════════════════════════════════════════════════════════════════
  // SHARED REFRESH FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════════════

  async function refreshSummary() {
    const { data } = await supabase
      .from('v_treasury_summary')
      .select('*')
      .eq('company_id', idEmpresa)
      .single()
    if (data) setSummary(data)
  }

  async function refreshLedger() {
    const { data } = await supabase
      .from('v_ledger_entries')
      .select('*')
      .eq('company_id', idEmpresa)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000)
    if (data) setLedger(data)
  }

  async function refreshCompras() {
    const { data } = await supabase
      .from('purchases')
      .select('*')
      .eq('company_id', idEmpresa)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, 999)
    if (data) setCompras(data)
  }

  async function refreshProveedoresYPagos() {
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

  async function refreshClientBalances() {
    const { data } = await supabase
      .from('v_client_balances')
      .select('*')
      .eq('company_id', idEmpresa)
    if (data) setClientBalances(data)
  }

  async function refreshAll() {
    setDashboardCargando(true)
    try {
      await Promise.all([
        refreshSummary(),
        refreshLedger(),
        refreshCompras(),
        refreshProveedoresYPagos(),
        refreshClientBalances(),
      ])
      toast.success('Datos actualizados.')
    } catch {
      toast.error('Error al actualizar.')
    } finally {
      setDashboardCargando(false)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DASHBOARD LOGIC
  // ══════════════════════════════════════════════════════════════════════════════

  const ledgerFiltrado = useMemo(() => {
    return ledger.filter(e => {
      if (ledgerFiltroTipo !== 'todos' && e.entry_type !== ledgerFiltroTipo) return false
      if (ledgerFiltroRango !== 'todos') {
        const limiteDias = Number(ledgerFiltroRango)
        const fechaLimite = new Date()
        fechaLimite.setDate(fechaLimite.getDate() - limiteDias)
        if (new Date(e.entry_date) < fechaLimite) return false
      }
      const q = ledgerFiltroBusqueda.toLowerCase().trim()
      if (q) {
        const conceptoMatch = e.concept.toLowerCase().includes(q)
        const metodoMatch = (e.payment_method || '').toLowerCase().includes(q)
        if (!conceptoMatch && !metodoMatch) return false
      }
      return true
    })
  }, [ledger, ledgerFiltroTipo, ledgerFiltroRango, ledgerFiltroBusqueda])

  const ledgerMetrics = useMemo(() => {
    let ingresos = 0
    let egresos = 0
    ledgerFiltrado.forEach(e => {
      if (e.entry_type === 'ingreso') ingresos += e.amount
      else egresos += e.amount
    })
    return { totalIngresos: ingresos, totalEgresos: egresos, neto: ingresos - egresos }
  }, [ledgerFiltrado])

  const LEDGER_PER_PAGE = 20
  const ledgerTotalPages = Math.ceil(ledgerFiltrado.length / LEDGER_PER_PAGE)
  const ledgerPaginado = useMemo(() => {
    const inicio = (ledgerPagina - 1) * LEDGER_PER_PAGE
    return ledgerFiltrado.slice(inicio, inicio + LEDGER_PER_PAGE)
  }, [ledgerFiltrado, ledgerPagina])

  // ══════════════════════════════════════════════════════════════════════════════
  // COMPRAS LOGIC
  // ══════════════════════════════════════════════════════════════════════════════

  const productosFiltradosSelector = useMemo(() => {
    const q = busquedaProducto.toLowerCase().trim()
    if (!q) return productos.slice(0, 10)
    return productos.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.internal_code && p.internal_code.toLowerCase().includes(q))
    ).slice(0, 10)
  }, [productos, busquedaProducto])

  const precioVentaRecomendado = useMemo(() => {
    if (!productoSeleccionado) return 0
    const costoAnterior = productoSeleccionado.cost_price || 0
    const ventaAnterior = productoSeleccionado.sale_price || 0
    const costoNuevo = Number(costoUnitario) || 0
    if (costoAnterior > 0) {
      const markup = ventaAnterior / costoAnterior
      return Number((costoNuevo * markup).toFixed(2))
    }
    return Number((costoNuevo * 1.40).toFixed(2))
  }, [productoSeleccionado, costoUnitario])

  useEffect(() => {
    if (productoSeleccionado) {
      setPrecioVentaNuevo(String(precioVentaRecomendado))
    }
  }, [precioVentaRecomendado, productoSeleccionado])

  function handleSeleccionarProducto(prod: Producto) {
    setProductoSeleccionado(prod)
    setBusquedaProducto(prod.name)
    setCostoUnitario(String(prod.cost_price || 0))
    setProveedor(prod.supplier || '')
    setMostrarDropdown(false)
    setActualizarPrecioVenta(false)
  }

  const totalSimulado = useMemo(() => {
    return (Number(cantidad) || 0) * (Number(costoUnitario) || 0)
  }, [cantidad, costoUnitario])

  const variacionCostoSimulada = useMemo(() => {
    if (!productoSeleccionado) return 0
    const costoAnterior = productoSeleccionado.cost_price || 0
    const costoNuevo = Number(costoUnitario) || 0
    if (costoAnterior <= 0) return 0
    return Number((((costoNuevo - costoAnterior) / costoAnterior) * 100).toFixed(2))
  }, [productoSeleccionado, costoUnitario])

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
          notes: observaciones || null,
          record_type: recordType,
        })

      if (purchaseErr) throw purchaseErr

      const camposActualizar: any = {
        cost_price: nuevoCostoNum,
        last_price_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

      setProductos(prev =>
        prev.map(p => {
          if (p.id === productoSeleccionado.id) {
            return {
              ...p,
              cost_price: nuevoCostoNum,
              sale_price: actualizarPrecioVenta ? nuevoVentaNum : p.sale_price,
              last_price_update: camposActualizar.last_price_update,
            }
          }
          return p
        })
      )

      limpiarSimulador()
      await Promise.all([refreshCompras(), refreshProveedoresYPagos(), refreshSummary(), refreshLedger()])
    } catch (err: any) {
      toast.error('Error al guardar compra: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  const comprasFiltradas = useMemo(() => {
    const q = filtroBusquedaCompras.toLowerCase().trim()
    if (!q) return compras
    return compras.filter(c =>
      c.product_name.toLowerCase().includes(q) ||
      (c.product_code && c.product_code.toLowerCase().includes(q)) ||
      (c.supplier && c.supplier.toLowerCase().includes(q)) ||
      (c.provider_invoice && c.provider_invoice.toLowerCase().includes(q))
    )
  }, [compras, filtroBusquedaCompras])

  const COMPRAS_PER_PAGE = 15
  const comprasPaginadas = useMemo(() => {
    const inicio = (paginaCompras - 1) * COMPRAS_PER_PAGE
    return comprasFiltradas.slice(inicio, inicio + COMPRAS_PER_PAGE)
  }, [comprasFiltradas, paginaCompras])
  const comprasTotalPages = Math.ceil(comprasFiltradas.length / COMPRAS_PER_PAGE)

  // ══════════════════════════════════════════════════════════════════════════════
  // PROVEEDORES LOGIC
  // ══════════════════════════════════════════════════════════════════════════════

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
          email: nuevoProveedorEmail.trim() || null,
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Proveedor registrado correctamente.')
      setProveedores(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSupplierId(data.id)
      setProveedor(data.name)
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

  const balancesProveedores = useMemo<SupplierBalance[]>(() => {
    const balances: Record<string, SupplierBalance> = {}
    proveedores.forEach(p => {
      balances[p.id] = {
        supplier: p.name,
        supplier_id: p.id,
        total_purchased: 0,
        total_paid: 0,
        balance_due: 0,
        purchase_count: 0,
      }
    })
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
    pagosProveedores.forEach(sp => {
      if (sp.supplier_id && balances[sp.supplier_id]) {
        balances[sp.supplier_id].total_paid += sp.amount
        balances[sp.supplier_id].balance_due -= sp.amount
      }
    })
    return Object.values(balances)
  }, [proveedores, compras, pagosProveedores])

  const balancesFiltrados = useMemo(() => {
    const q = filtroProveedor.toLowerCase().trim()
    if (!q) return balancesProveedores
    return balancesProveedores.filter(b => b.supplier.toLowerCase().includes(q))
  }, [balancesProveedores, filtroProveedor])

  const comprasPendientesProveedor = useMemo(() => {
    if (!selectedSupplierForPayment) return []
    return compras.filter(c =>
      c.supplier_id === selectedSupplierForPayment.supplier_id &&
      c.payment_status === 'pending'
    )
  }, [compras, selectedSupplierForPayment])

  async function registrarPagoProveedor() {
    if (!selectedSupplierForPayment || !pagoMonto) return
    const montoNum = Number(pagoMonto)
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingresá un monto válido.')
      return
    }

    setGuardandoPago(true)
    try {
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
          user_id: userId,
          record_type: recordType,
        })

      if (spErr) throw spErr

      // Imputar pago
      if (pagoPurchaseId) {
        const compra = compras.find(c => c.id === pagoPurchaseId)
        if (compra) {
          const nuevoMontoPagado = (compra.amount_paid || 0) + montoNum
          const nuevoEstado = nuevoMontoPagado >= (compra.total_cost || 0) ? 'paid' : 'pending'
          await supabase
            .from('purchases')
            .update({ amount_paid: nuevoMontoPagado, payment_status: nuevoEstado })
            .eq('id', pagoPurchaseId)
        }
      } else {
        // FIFO
        let remanente = montoNum
        const pendientes = compras
          .filter(c => c.supplier_id === selectedSupplierForPayment.supplier_id && c.payment_status === 'pending')
          .filter(c => c.record_type === recordType)
          .sort((a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime())

        for (const c of pendientes) {
          if (remanente <= 0) break
          const pendienteCompra = (c.total_cost || 0) - (c.amount_paid || 0)
          const abonar = Math.min(remanente, pendienteCompra)
          const nuevoMontoPagado = (c.amount_paid || 0) + abonar
          const nuevoEstado = nuevoMontoPagado >= (c.total_cost || 0) ? 'paid' : 'pending'

          await supabase
            .from('purchases')
            .update({ amount_paid: nuevoMontoPagado, payment_status: nuevoEstado })
            .eq('id', c.id)

          remanente -= abonar
        }
      }

      toast.success('Pago registrado correctamente.')
      setSelectedSupplierForPayment(null)
      setPagoMonto('')
      setPagoPurchaseId('')
      setPagoDescripcion('Pago de deuda')

      await Promise.all([refreshCompras(), refreshProveedoresYPagos(), refreshSummary(), refreshLedger()])
    } catch (err: any) {
      toast.error('Error al registrar el pago: ' + err.message)
    } finally {
      setGuardandoPago(false)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // CLIENTES LOGIC
  // ══════════════════════════════════════════════════════════════════════════════

  const clientesFiltrados = useMemo(() => {
    const q = filtroCliente.toLowerCase().trim()
    if (!q) return clientBalances.filter(c => c.balance_due > 0)
    return clientBalances
      .filter(c => c.balance_due > 0)
      .filter(c =>
        c.client_name.toLowerCase().includes(q) ||
        (c.cuit && c.cuit.toLowerCase().includes(q))
      )
  }, [clientBalances, filtroCliente])

  async function registrarCobroCliente() {
    if (!selectedClientForPayment || !cobroMonto) return
    const montoNum = Number(cobroMonto)
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingresá un monto válido.')
      return
    }

    setGuardandoCobro(true)
    try {
      const { error } = await supabase
        .from('account_movements')
        .insert({
          company_id: idEmpresa,
          client_id: selectedClientForPayment.client_id,
          movement_date: new Date().toISOString().split('T')[0],
          movement_type: 'Pago',
          payment_type: 'Pago parcial',
          payment_method: cobroMetodo,
          description: cobroDescripcion || 'Pago recibido',
          debit: 0,
          credit: montoNum,
          record_type: recordType,
        })

      if (error) throw error

      toast.success('Cobro registrado correctamente.')
      setSelectedClientForPayment(null)
      setCobroMonto('')
      setCobroDescripcion('Pago recibido')

      await Promise.all([refreshClientBalances(), refreshSummary(), refreshLedger()])
    } catch (err: any) {
      toast.error('Error al registrar cobro: ' + err.message)
    } finally {
      setGuardandoCobro(false)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // EXCEL EXPORT
  // ══════════════════════════════════════════════════════════════════════════════

  function exportarLedgerAExcel() {
    if (ledgerFiltrado.length === 0) {
      toast.error('No hay registros para exportar.')
      return
    }

    let filasHtml = ''
    ledgerFiltrado.forEach((e, index) => {
      const claseZebra = index % 2 === 0 ? '' : 'class="bg-zebra"'
      const claseTipo = e.entry_type === 'ingreso' ? 'class="var-up"' : 'class="var-down"'
      filasHtml += `
        <tr ${claseZebra}>
          <td class="text-center">${new Date(e.entry_date).toLocaleDateString('es-AR')}</td>
          <td>${e.concept}</td>
          <td ${claseTipo} class="text-center">${e.entry_type.toUpperCase()}</td>
          <td>${e.payment_method || '-'}</td>
          <td class="text-right">$${e.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        </tr>
      `
    })

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Flujo de Caja</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          table { border-collapse: collapse; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; }
          th { background-color: #0f766e; color: #ffffff; font-weight: bold; text-transform: uppercase; border: 1px solid #cbd5e1; padding: 10px; font-size: 9pt; }
          td { border: 1px solid #cbd5e1; padding: 8px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .bg-title { background-color: #0f172a; color: #ffffff; font-size: 16pt; font-weight: bold; text-align: center; height: 45px; }
          .bg-subtitle { background-color: #1e293b; color: #cbd5e1; font-size: 11pt; text-align: center; }
          .bg-zebra { background-color: #f8fafc; }
          .bg-total { background-color: #ccfbf1; font-weight: bold; color: #0f766e; }
          .var-up { color: #16a34a; font-weight: bold; }
          .var-down { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="5" class="bg-title">FLUJO DE CAJA — TESORERÍA</td></tr>
          <tr><td colspan="5" class="bg-subtitle">Generado el: ${new Date().toLocaleDateString('es-AR')} | Registros: ${ledgerFiltrado.length}</td></tr>
          <tr><td colspan="5" style="height: 15px; border: none;"></td></tr>
          <tr>
            <th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Medio de Pago</th><th class="text-right">Monto</th>
          </tr>
          ${filasHtml}
          <tr class="bg-total">
            <td colspan="3" style="border-top: 2px solid #0f766e;">TOTALES</td>
            <td style="border-top: 2px solid #0f766e;">Ingresos: $${ledgerMetrics.totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td class="text-right" style="border-top: 2px solid #0f766e;">Egresos: $${ledgerMetrics.totalEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          </tr>
        </table>
      </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `tesoreria-flujo-caja-${new Date().toISOString().split('T')[0]}.xls`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Excel exportado correctamente.')
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden space-y-6 pb-12">

      {/* ═══ HERO HEADER ═══ */}
      <section className="relative w-full max-w-full overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-16 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-teal-200">
              <Landmark size={13} />
              Centro de Control Financiero
            </div>
            <h1 className="truncate text-3xl font-black tracking-tight font-sans">
              Tesorería
            </h1>
            <p className="mt-1 line-clamp-1 text-sm text-slate-350 font-sans">
              Balance general, compras, deudas con proveedores y cuentas por cobrar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              onClick={exportarLedgerAExcel}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-500 cursor-pointer"
            >
              <FileSpreadsheet size={16} /> Exportar Excel
            </button>
            <button
              onClick={refreshAll}
              disabled={dashboardCargando}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/15 cursor-pointer"
            >
              <RefreshCw size={15} className={dashboardCargando ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>
        </div>

        {/* ═══ TAB BAR ═══ */}
        <div className="relative z-10 mt-6 flex gap-1 overflow-x-auto rounded-2xl bg-white/5 p-1 backdrop-blur-sm">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer
                  ${isActive
                    ? 'bg-white text-slate-900 shadow-lg'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB A: DASHBOARD */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Balance Neto */}
            <div className={`rounded-2xl border p-5 shadow-sm transition-all ${
              (summary?.net_balance || 0) >= 0 
                ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50' 
                : 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Balance General Neto</span>
                <div className={`rounded-xl p-2 ${(summary?.net_balance || 0) >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  <DollarSign size={18} className={(summary?.net_balance || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                </div>
              </div>
              <p className={`mt-3 text-2xl font-black ${(summary?.net_balance || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatCurrency(summary?.net_balance || 0)}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">Flujo de caja + deuda activa − deuda pasiva</p>
            </div>

            {/* Deuda Pasiva (Proveedores) */}
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Deuda a Proveedores</span>
                <div className="rounded-xl bg-amber-100 p-2">
                  <Truck size={18} className="text-amber-600" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-black text-amber-700">
                {formatCurrency(summary?.total_supplier_debt || 0)}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">Total acumulado deuda pasiva</p>
            </div>

            {/* Deuda Activa (Clientes) */}
            <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Deuda de Clientes</span>
                <div className="rounded-xl bg-cyan-100 p-2">
                  <Users size={18} className="text-cyan-600" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-black text-cyan-700">
                {formatCurrency(summary?.total_client_debt || 0)}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">Total acumulado cuentas por cobrar</p>
            </div>

            {/* Flujo de Caja */}
            <div className={`rounded-2xl border p-5 shadow-sm transition-all ${
              (summary?.net_cash_flow || 0) >= 0 
                ? 'border-green-200 bg-gradient-to-br from-green-50 to-lime-50' 
                : 'border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Flujo de Caja Real</span>
                <div className={`rounded-xl p-2 ${(summary?.net_cash_flow || 0) >= 0 ? 'bg-green-100' : 'bg-rose-100'}`}>
                  {(summary?.net_cash_flow || 0) >= 0 
                    ? <TrendingUp size={18} className="text-green-600" />
                    : <TrendingDown size={18} className="text-rose-600" />
                  }
                </div>
              </div>
              <p className={`mt-3 text-2xl font-black ${(summary?.net_cash_flow || 0) >= 0 ? 'text-green-700' : 'text-rose-700'}`}>
                {formatCurrency(summary?.net_cash_flow || 0)}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">Cobros recibidos − pagos realizados</p>
            </div>
          </div>

          {/* Ledger table */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <BookOpen size={20} className="text-teal-600" />
                Flujo de Caja — Libro Diario
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                  <ArrowUpRight size={13} className="inline mr-1" />{formatCurrency(ledgerMetrics.totalIngresos)}
                </span>
                <span className="text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                  <ArrowDownLeft size={13} className="inline mr-1" />{formatCurrency(ledgerMetrics.totalEgresos)}
                </span>
                <span className={`rounded-xl px-3 py-1.5 border ${
                  ledgerMetrics.neto >= 0 
                    ? 'text-teal-700 bg-teal-50 border-teal-200' 
                    : 'text-red-700 bg-red-50 border-red-200'
                }`}>
                  Neto: {formatCurrency(ledgerMetrics.neto)}
                </span>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por concepto..."
                  value={ledgerFiltroBusqueda}
                  onChange={e => { setLedgerFiltroBusqueda(e.target.value); setLedgerPagina(1) }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </div>
              <select
                value={ledgerFiltroTipo}
                onChange={e => { setLedgerFiltroTipo(e.target.value as any); setLedgerPagina(1) }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:border-teal-500"
              >
                <option value="todos">Todos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
              </select>
              <select
                value={ledgerFiltroRango}
                onChange={e => { setLedgerFiltroRango(e.target.value as any); setLedgerPagina(1) }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:border-teal-500"
              >
                <option value="30">Últimos 30 días</option>
                <option value="90">Últimos 90 días</option>
                <option value="365">Último año</option>
                <option value="todos">Todo el historial</option>
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3 text-left">Fecha</th>
                    <th className="py-3 px-3 text-left">Concepto</th>
                    <th className="py-3 px-3 text-center">Tipo</th>
                    <th className="py-3 px-3 text-left">Medio de Pago</th>
                    <th className="py-3 px-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerPaginado.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 text-sm font-semibold">
                        No se encontraron movimientos.
                      </td>
                    </tr>
                  ) : ledgerPaginado.map((e, i) => (
                    <tr key={e.id} className={`border-b border-slate-100 transition hover:bg-slate-50 ${i % 2 !== 0 ? 'bg-slate-50/50' : ''}`}>
                      <td className="py-3 px-3 text-slate-600 font-semibold">
                        {new Date(e.entry_date).toLocaleDateString('es-AR')}
                      </td>
                      <td className="py-3 px-3 text-slate-800 font-semibold max-w-[300px] truncate">
                        {e.concept}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase ${
                          e.entry_type === 'ingreso'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {e.entry_type === 'ingreso' ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />}
                          {e.entry_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-semibold">{e.payment_method || '-'}</td>
                      <td className={`py-3 px-3 text-right font-black ${e.entry_type === 'ingreso' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatCurrency(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {ledgerTotalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500 font-semibold">
                  Página {ledgerPagina} de {ledgerTotalPages} — {ledgerFiltrado.length} registros
                </p>
                <div className="flex gap-1">
                  <button
                    disabled={ledgerPagina <= 1}
                    onClick={() => setLedgerPagina(p => p - 1)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={ledgerPagina >= ledgerTotalPages}
                    onClick={() => setLedgerPagina(p => p + 1)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB B: COMPRAS */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'compras' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* CALCULATOR */}
            <section className="lg:col-span-2 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Settings2 size={20} className="text-teal-600" />
                  Calculadora &amp; Registro de Compra
                </h2>
                {productoSeleccionado && (
                  <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 animate-pulse">
                    Modo Simulación Activo
                  </span>
                )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {/* Product search */}
                <div className="relative space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Seleccionar Producto</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar producto por nombre o código..."
                      value={busquedaProducto}
                      onChange={e => { setBusquedaProducto(e.target.value); setMostrarDropdown(true) }}
                      onFocus={() => setMostrarDropdown(true)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm font-semibold outline-none transition focus:border-teal-500 focus:bg-white"
                    />
                  </div>

                  {mostrarDropdown && (
                    <div className="absolute left-0 right-0 z-25 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {productosFiltradosSelector.length === 0 ? (
                        <div className="p-4 text-xs text-slate-500 font-bold text-center">No se encontraron productos.</div>
                      ) : (
                        productosFiltradosSelector.map(prod => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleSeleccionarProducto(prod)}
                            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-800">{prod.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {prod.internal_code || 'Sin código'} · {prod.category || 'Sin categoría'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-black text-slate-700">{formatCurrency(prod.cost_price || 0)}</p>
                              <p className="text-[10px] text-slate-400">Costo actual</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Supplier selector */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Proveedor</label>
                  <div className="flex gap-2">
                    <select
                      value={supplierId}
                      onChange={e => {
                        const id = e.target.value
                        setSupplierId(id)
                        const prov = proveedores.find(p => p.id === id)
                        setProveedor(prov?.name || '')
                      }}
                      className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-teal-500"
                    >
                      <option value="">Seleccionar proveedor...</option>
                      {proveedores.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setMostrandoFormProveedor(true)}
                      className="shrink-0 rounded-2xl border border-teal-200 bg-teal-50 px-3 text-teal-700 transition hover:bg-teal-100 cursor-pointer"
                      title="Nuevo Proveedor"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={cantidad}
                    onChange={e => setCantidad(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Unit cost */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Costo Unitario</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={costoUnitario}
                      onChange={e => setCostoUnitario(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-8 py-3 text-sm font-semibold outline-none transition focus:border-teal-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Fecha</label>
                  <input
                    type="date"
                    value={fechaCompra}
                    onChange={e => setFechaCompra(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-teal-500"
                  />
                </div>

                {/* Invoice */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">N° Factura / Remito</label>
                  <input
                    type="text"
                    placeholder="Ej: FC-A-00001234"
                    value={facturaProveedor}
                    onChange={e => setFacturaProveedor(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Payment method */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Medio de Pago</label>
                  <select
                    value={medioPago}
                    onChange={e => setMedioPago(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-teal-500"
                  >
                    <option>Transferencia</option>
                    <option>Efectivo</option>
                    <option>Cheque</option>
                    <option>Tarjeta</option>
                  </select>
                </div>

                {/* Payment status */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Estado de Pago</label>
                  <select
                    value={paymentStatus}
                    onChange={e => setPaymentStatus(e.target.value as 'paid' | 'pending')}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-teal-500"
                  >
                    <option value="paid">✅ Pagado</option>
                    <option value="pending">⏳ Pendiente / Cuenta Corriente</option>
                  </select>
                </div>

                {/* Amount paid (only for pending) */}
                {paymentStatus === 'pending' && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Monto Pagado Parcial</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountPaid}
                        onChange={e => setAmountPaid(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-8 py-3 text-sm font-semibold outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                    </div>
                    <p className="text-[10px] text-amber-600 font-semibold">
                      Dejalo en 0 si no se pagó nada. La diferencia queda como deuda con el proveedor.
                    </p>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Observaciones</label>
                  <input
                    type="text"
                    placeholder="Notas adicionales..."
                    value={observaciones}
                    onChange={e => setObservaciones(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <RecordTypeSelector value={recordType} onChange={setRecordType} />
                </div>
              </div>

              {/* Update sale price option */}
              {productoSeleccionado && (
                <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={actualizarPrecioVenta}
                      onChange={e => setActualizarPrecioVenta(e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    <span className="text-sm font-bold text-teal-800">Actualizar precio de venta del producto</span>
                  </label>
                  {actualizarPrecioVenta && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-500">Nuevo precio de venta:</span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={precioVentaNuevo}
                          onChange={e => setPrecioVentaNuevo(e.target.value)}
                          className="rounded-xl border border-teal-200 bg-white px-7 py-2 text-sm font-bold outline-none focus:border-teal-500 w-40"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Recomendado: {formatCurrency(precioVentaRecomendado)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {productoSeleccionado && (
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmacion(true)}
                    disabled={guardando}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-500 disabled:opacity-50 cursor-pointer"
                  >
                    {guardando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    {guardando ? 'Guardando...' : 'Confirmar y Registrar Compra'}
                  </button>
                  <button
                    type="button"
                    onClick={limpiarSimulador}
                    className="rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 cursor-pointer"
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </section>

            {/* SIMULATION PANEL */}
            <section className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl space-y-5">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Info size={15} className="text-teal-400" />
                Panel de Simulación
              </h3>

              <div className="space-y-4">
                <div className="rounded-2xl bg-white/5 p-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Producto</p>
                  <p className="text-lg font-black truncate">{productoSeleccionado?.name || 'Ninguno seleccionado'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Costo Actual</p>
                    <p className="text-lg font-black text-slate-300">{formatCurrency(productoSeleccionado?.cost_price || 0)}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Costo Nuevo</p>
                    <p className="text-lg font-black text-teal-400">{formatCurrency(Number(costoUnitario) || 0)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Total Compra</p>
                    <p className="text-lg font-black text-white">{formatCurrency(totalSimulado)}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Variación</p>
                    <p className={`text-lg font-black ${variacionCostoSimulada > 0 ? 'text-red-400' : variacionCostoSimulada < 0 ? 'text-green-400' : 'text-slate-400'}`}>
                      {variacionCostoSimulada > 0 ? '+' : ''}{variacionCostoSimulada}%
                    </p>
                  </div>
                </div>

                {paymentStatus === 'pending' && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-amber-300 font-black">Deuda Generada</p>
                    <p className="text-lg font-black text-amber-400">
                      {formatCurrency(totalSimulado - (Number(amountPaid) || 0))}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* PURCHASE HISTORY TABLE */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xl font-black text-slate-900">
                Historial de Compras ({compras.length})
              </h2>
              <div className="relative min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar en historial..."
                  value={filtroBusquedaCompras}
                  onChange={e => { setFiltroBusquedaCompras(e.target.value); setPaginaCompras(1) }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-2 text-left">Fecha</th>
                    <th className="py-3 px-2 text-left">Producto</th>
                    <th className="py-3 px-2 text-left">Proveedor</th>
                    <th className="py-3 px-2 text-right">Cant.</th>
                    <th className="py-3 px-2 text-right">C. Unit.</th>
                    <th className="py-3 px-2 text-right">Total</th>
                    <th className="py-3 px-2 text-center">Variación</th>
                    <th className="py-3 px-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasPaginadas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 text-sm font-semibold">
                        No hay compras registradas.
                      </td>
                    </tr>
                  ) : comprasPaginadas.map((c, i) => (
                    <tr key={c.id} className={`border-b border-slate-100 transition hover:bg-slate-50 ${i % 2 !== 0 ? 'bg-slate-50/50' : ''}`}>
                      <td className="py-3 px-2 text-slate-600 font-semibold whitespace-nowrap">
                        {new Date(c.purchase_date).toLocaleDateString('es-AR')}
                      </td>
                      <td className="py-3 px-2 font-semibold text-slate-800 max-w-[180px] truncate">{c.product_name}</td>
                      <td className="py-3 px-2 text-slate-500 font-semibold max-w-[120px] truncate">{c.supplier || '-'}</td>
                      <td className="py-3 px-2 text-right font-bold text-slate-700">{c.quantity}</td>
                      <td className="py-3 px-2 text-right font-semibold text-slate-600">{formatCurrency(c.unit_cost)}</td>
                      <td className="py-3 px-2 text-right font-black text-slate-800">{formatCurrency(c.total_cost)}</td>
                      <td className="py-3 px-2 text-center">
                        {c.previous_cost > 0 ? (
                          <span className={`text-xs font-black ${c.cost_variation > 0 ? 'text-red-600' : c.cost_variation < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                            {c.cost_variation > 0 ? '+' : ''}{c.cost_variation}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Nuevo</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase ${
                          c.payment_status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {c.payment_status === 'paid' ? <CheckCircle size={10} /> : <HelpCircle size={10} />}
                          {c.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {comprasTotalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500 font-semibold">
                  Página {paginaCompras} de {comprasTotalPages} — {comprasFiltradas.length} registros
                </p>
                <div className="flex gap-1">
                  <button disabled={paginaCompras <= 1} onClick={() => setPaginaCompras(p => p - 1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 cursor-pointer">
                    <ChevronLeft size={16} />
                  </button>
                  <button disabled={paginaCompras >= comprasTotalPages} onClick={() => setPaginaCompras(p => p + 1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 cursor-pointer">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB C: PROVEEDORES */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'proveedores' && (
        <div className="space-y-6">
          {/* Summary strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Proveedores Activos</p>
              <p className="mt-1 text-2xl font-black text-slate-800">{proveedores.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Deuda Total</p>
              <p className="mt-1 text-2xl font-black text-amber-700">
                {formatCurrency(balancesProveedores.reduce((acc, b) => acc + Math.max(b.balance_due, 0), 0))}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Con Saldo Pendiente</p>
              <p className="mt-1 text-2xl font-black text-red-600">
                {balancesProveedores.filter(b => b.balance_due > 0).length}
              </p>
            </div>
          </div>

          {/* Suppliers table */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Truck size={20} className="text-amber-600" />
                Deudas con Proveedores
              </h2>
              <div className="flex gap-2">
                <div className="relative min-w-[200px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar proveedor..."
                    value={filtroProveedor}
                    onChange={e => setFiltroProveedor(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-teal-500"
                  />
                </div>
                <button
                  onClick={() => setMostrandoFormProveedor(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-500 cursor-pointer"
                >
                  <Plus size={15} /> Nuevo
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3 text-left">Proveedor</th>
                    <th className="py-3 px-3 text-right">Compras</th>
                    <th className="py-3 px-3 text-right">Total Comprado</th>
                    <th className="py-3 px-3 text-right">Total Pagado</th>
                    <th className="py-3 px-3 text-right">Saldo Adeudado</th>
                    <th className="py-3 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {balancesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 text-sm font-semibold">
                        No hay proveedores registrados.
                      </td>
                    </tr>
                  ) : balancesFiltrados.map((b, i) => (
                    <tr key={b.supplier_id} className={`border-b border-slate-100 transition hover:bg-slate-50 ${i % 2 !== 0 ? 'bg-slate-50/50' : ''}`}>
                      <td className="py-3 px-3 font-bold text-slate-800">{b.supplier}</td>
                      <td className="py-3 px-3 text-right text-slate-600 font-semibold">{b.purchase_count}</td>
                      <td className="py-3 px-3 text-right text-slate-600 font-semibold">{formatCurrency(b.total_purchased)}</td>
                      <td className="py-3 px-3 text-right text-slate-600 font-semibold">{formatCurrency(b.total_paid)}</td>
                      <td className={`py-3 px-3 text-right font-black ${b.balance_due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrency(b.balance_due)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {b.balance_due > 0 && (
                          <button
                            onClick={() => {
                              setSelectedSupplierForPayment(b)
                              setPagoMonto('')
                              setPagoPurchaseId('')
                              setPagoFecha(new Date().toISOString().split('T')[0])
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-teal-500 cursor-pointer"
                          >
                            <CreditCard size={12} /> Registrar Pago
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB D: CLIENTES */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'clientes' && (
        <div className="space-y-6">
          {/* Summary strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Clientes con Deuda</p>
              <p className="mt-1 text-2xl font-black text-slate-800">{clientBalances.filter(c => c.balance_due > 0).length}</p>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Total por Cobrar</p>
              <p className="mt-1 text-2xl font-black text-cyan-700">
                {formatCurrency(clientBalances.reduce((acc, c) => acc + Math.max(c.balance_due, 0), 0))}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Total Cobrado</p>
              <p className="mt-1 text-2xl font-black text-emerald-700">
                {formatCurrency(clientBalances.reduce((acc, c) => acc + c.total_credit, 0))}
              </p>
            </div>
          </div>

          {/* Client debts table */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Users size={20} className="text-cyan-600" />
                Cuentas por Cobrar
              </h2>
              <div className="relative min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={filtroCliente}
                  onChange={e => setFiltroCliente(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-teal-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3 text-left">Cliente</th>
                    <th className="py-3 px-3 text-left">CUIT</th>
                    <th className="py-3 px-3 text-right">Total Facturado</th>
                    <th className="py-3 px-3 text-right">Total Cobrado</th>
                    <th className="py-3 px-3 text-right">Saldo Pendiente</th>
                    <th className="py-3 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 text-sm font-semibold">
                        No hay clientes con saldo pendiente.
                      </td>
                    </tr>
                  ) : clientesFiltrados.map((c, i) => (
                    <tr key={c.client_id} className={`border-b border-slate-100 transition hover:bg-slate-50 ${i % 2 !== 0 ? 'bg-slate-50/50' : ''}`}>
                      <td className="py-3 px-3 font-bold text-slate-800">{c.client_name}</td>
                      <td className="py-3 px-3 text-slate-500 font-semibold">{c.cuit || '-'}</td>
                      <td className="py-3 px-3 text-right text-slate-600 font-semibold">{formatCurrency(c.total_debit)}</td>
                      <td className="py-3 px-3 text-right text-slate-600 font-semibold">{formatCurrency(c.total_credit)}</td>
                      <td className="py-3 px-3 text-right font-black text-red-600">{formatCurrency(c.balance_due)}</td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedClientForPayment(c)
                            setCobroMonto('')
                            setCobroMetodo(paymentMethods[0] || 'Transferencia')
                            setCobroDescripcion('Pago recibido')
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-cyan-500 cursor-pointer"
                        >
                          <CreditCard size={12} /> Registrar Cobro
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {/* ─── Confirmation Modal (Compras) ──── */}
      {mostrarConfirmacion && productoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setMostrarConfirmacion(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Confirmar Compra</h3>
              <button onClick={() => setMostrarConfirmacion(false)} className="rounded-full p-1 hover:bg-slate-100 cursor-pointer">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm"><strong>Producto:</strong> {productoSeleccionado.name}</p>
              <p className="text-sm"><strong>Proveedor:</strong> {proveedor || 'Sin especificar'}</p>
              <p className="text-sm"><strong>Cantidad:</strong> {cantidad} × {formatCurrency(Number(costoUnitario))} = <strong>{formatCurrency(totalSimulado)}</strong></p>
              <p className="text-sm"><strong>Estado:</strong>{' '}
                <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-black uppercase ${
                  paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {paymentStatus === 'paid' ? '✅ Pagado' : '⏳ Pendiente'}
                </span>
              </p>
              {actualizarPrecioVenta && (
                <p className="text-sm"><strong>Nuevo Precio de Venta:</strong> {formatCurrency(Number(precioVentaNuevo))}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={guardarCompra}
                disabled={guardando}
                className="flex-1 rounded-2xl bg-teal-600 py-3 text-sm font-bold text-white transition hover:bg-teal-500 disabled:opacity-50 cursor-pointer"
              >
                {guardando ? 'Guardando...' : 'Confirmar'}
              </button>
              <button
                onClick={() => setMostrarConfirmacion(false)}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── New Supplier Modal ──── */}
      {mostrandoFormProveedor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setMostrandoFormProveedor(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Nuevo Proveedor</h3>
              <button onClick={() => setMostrandoFormProveedor(false)} className="rounded-full p-1 hover:bg-slate-100 cursor-pointer">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre del proveedor *"
                value={nuevoProveedorNombre}
                onChange={e => setNuevoProveedorNombre(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-teal-500 focus:bg-white"
              />
              <input
                type="text"
                placeholder="CUIT (opcional)"
                value={nuevoProveedorCuit}
                onChange={e => setNuevoProveedorCuit(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-teal-500 focus:bg-white"
              />
              <input
                type="text"
                placeholder="Teléfono (opcional)"
                value={nuevoProveedorPhone}
                onChange={e => setNuevoProveedorPhone(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-teal-500 focus:bg-white"
              />
              <input
                type="email"
                placeholder="Email (opcional)"
                value={nuevoProveedorEmail}
                onChange={e => setNuevoProveedorEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-teal-500 focus:bg-white"
              />
            </div>
            <button
              onClick={handleCrearProveedor}
              disabled={guardandoProveedor || !nuevoProveedorNombre.trim()}
              className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-bold text-white transition hover:bg-teal-500 disabled:opacity-50 cursor-pointer"
            >
              {guardandoProveedor ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Registrar Proveedor'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Supplier Payment Modal ──── */}
      {selectedSupplierForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedSupplierForPayment(null)}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Registrar Pago a Proveedor</h3>
              <button onClick={() => setSelectedSupplierForPayment(null)} className="rounded-full p-1 hover:bg-slate-100 cursor-pointer">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-1">
              <p className="text-sm font-bold text-amber-800">{selectedSupplierForPayment.supplier}</p>
              <p className="text-xs text-amber-700">
                Deuda actual: <strong>{formatCurrency(selectedSupplierForPayment.balance_due)}</strong>
              </p>
            </div>

            <div className="space-y-3">
              {/* Imputar a compra específica o FIFO */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Imputar a Compra</label>
                <select
                  value={pagoPurchaseId}
                  onChange={e => setPagoPurchaseId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-teal-500"
                >
                  <option value="">Automático (FIFO — más antiguas primero)</option>
                  {comprasPendientesProveedor.filter(c => c.record_type === recordType).map(c => (
                    <option key={c.id} value={c.id}>
                      {new Date(c.purchase_date).toLocaleDateString('es-AR')} — {c.product_name} — Pendiente: {formatCurrency((c.total_cost || 0) - (c.amount_paid || 0))}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Monto del Pago</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pagoMonto}
                    onChange={e => setPagoMonto(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-8 py-3 text-sm font-semibold outline-none focus:border-teal-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Medio de Pago</label>
                  <select
                    value={pagoMetodo}
                    onChange={e => setPagoMetodo(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-teal-500"
                  >
                    <option>Transferencia</option>
                    <option>Efectivo</option>
                    <option>Cheque</option>
                    <option>Tarjeta</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Fecha</label>
                  <input
                    type="date"
                    value={pagoFecha}
                    onChange={e => setPagoFecha(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Descripción</label>
                <input
                  type="text"
                  value={pagoDescripcion}
                  onChange={e => setPagoDescripcion(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="space-y-2">
                <RecordTypeSelector value={recordType} onChange={setRecordType} />
              </div>
            </div>

            <button
              onClick={registrarPagoProveedor}
              disabled={guardandoPago || !pagoMonto || Number(pagoMonto) <= 0}
              className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-bold text-white transition hover:bg-teal-500 disabled:opacity-50 cursor-pointer"
            >
              {guardandoPago ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Registrar Pago'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Client Payment Modal ──── */}
      {selectedClientForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedClientForPayment(null)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Registrar Cobro</h3>
              <button onClick={() => setSelectedClientForPayment(null)} className="rounded-full p-1 hover:bg-slate-100 cursor-pointer">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="rounded-2xl bg-cyan-50 border border-cyan-200 p-4 space-y-1">
              <p className="text-sm font-bold text-cyan-800">{selectedClientForPayment.client_name}</p>
              <p className="text-xs text-cyan-700">
                Deuda actual: <strong>{formatCurrency(selectedClientForPayment.balance_due)}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Monto del Cobro</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cobroMonto}
                    onChange={e => setCobroMonto(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-8 py-3 text-sm font-semibold outline-none focus:border-teal-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Medio de Pago</label>
                <select
                  value={cobroMetodo}
                  onChange={e => setCobroMetodo(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-teal-500"
                >
                  {paymentMethods.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {paymentMethods.length === 0 && (
                    <>
                      <option>Transferencia</option>
                      <option>Efectivo</option>
                      <option>Cheque</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Descripción</label>
                <input
                  type="text"
                  value={cobroDescripcion}
                  onChange={e => setCobroDescripcion(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="space-y-2">
                <RecordTypeSelector value={recordType} onChange={setRecordType} />
              </div>
            </div>


            <button
              onClick={registrarCobroCliente}
              disabled={guardandoCobro || !cobroMonto || Number(cobroMonto) <= 0}
              className="w-full rounded-2xl bg-cyan-600 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50 cursor-pointer"
            >
              {guardandoCobro ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Registrar Cobro'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
