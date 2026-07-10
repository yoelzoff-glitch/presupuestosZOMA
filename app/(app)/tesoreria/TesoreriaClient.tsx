'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Search,
  Plus,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  ReceiptText,
  FileText,
  Trash2,
  CreditCard,
  ChevronRight,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from 'sonner'
import FilterButton from '@/app/components/FilterButton'
import { registerSupplierPurchaseAction } from './actions'
import RecordTypeSelector from '@/app/components/RecordTypeSelector'
import { useMirror } from '@/app/components/MirrorProvider'
import { Settings2, AlertTriangle, HelpCircle } from 'lucide-react'

type Supplier = {
  id: string
  name: string
  cuit: string | null
  phone: string | null
  email: string | null
  address: string | null
  balance?: number
}

type LedgerEntry = {
  id: string
  entry_date: string
  entry_type: 'ingreso' | 'egreso'
  concept: string
  amount: number
  payment_method: string | null
  created_at: string
}

type SupplierMovement = {
  id: string
  supplier_id: string
  movement_date: string
  movement_type: 'Compra' | 'Pago'
  payment_method: string | null
  description: string | null
  debit: number
  credit: number
  created_at: string
}

type Props = {
  companyId: string
  initialPaymentMethods: string[]
}

export default function TesoreriaClient({ companyId, initialPaymentMethods }: Props) {
  // Tabs and general state
  const [activeTab, setActiveTab] = useState<'flujo_caja' | 'proveedores' | 'cuenta_proveedor' | 'calculadora_compras'>('flujo_caja')
  const [loading, setLoading] = useState(true)
  const [exportingExcel, setExportingExcel] = useState(false)

  // KPIs
  const [cashBalance, setCashBalance] = useState(0)
  const [accountsReceivable, setAccountsReceivable] = useState(0)
  const [accountsPayable, setAccountsPayable] = useState(0)

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierMovements, setSupplierMovements] = useState<SupplierMovement[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)

  // Ledger state
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'ingreso' | 'egreso'>('all')
  const [daysFilter, setDaysFilter] = useState('all')

  // Modals state
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierCuit, setNewSupplierCuit] = useState('')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')
  const [newSupplierEmail, setNewSupplierEmail] = useState('')
  const [newSupplierAddress, setNewSupplierAddress] = useState('')

  // Supplier Movement Modals
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [movementModalType, setMovementModalType] = useState<'Compra' | 'Pago'>('Compra')
  const [savingMovement, setSavingMovement] = useState(false)
  const [movementAmount, setMovementAmount] = useState('')
  const [movementDescription, setMovementDescription] = useState('')
  const [movementDate, setMovementDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(initialPaymentMethods[0] || 'Efectivo')
  const [purchasePaymentType, setPurchasePaymentType] = useState<'cuenta_corriente' | 'pago_total' | 'pago_parcial'>('cuenta_corriente')
  const [purchasePaidAmount, setPurchasePaidAmount] = useState('')
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState(initialPaymentMethods[0] || 'Efectivo')

  // Delete states
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Calculator States
  const { isMirrorUser } = useMirror()
  const [products, setProducts] = useState<any[]>([])
  
  // Selected product & supplier
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [calcSupplierId, setCalcSupplierId] = useState('')
  const [calcQuantity, setCalcQuantity] = useState('1')
  const [calcUnitCost, setCalcUnitCost] = useState('')
  const [calcTaxRate, setCalcTaxRate] = useState('21') // default 21%
  const [calcOperationDate, setCalcOperationDate] = useState(new Date().toISOString().split('T')[0])
  const [calcInvoice, setCalcInvoice] = useState('')
  const [calcRemito, setCalcRemito] = useState('')
  const [calcNotes, setCalcNotes] = useState('')
  
  // Payment terms
  const [calcPaymentType, setCalcPaymentType] = useState<'cuenta_corriente' | 'pago_total' | 'pago_parcial'>('pago_total')
  const [calcAmountPaid, setCalcAmountPaid] = useState('')
  const [calcPaymentMethod, setCalcPaymentMethod] = useState(initialPaymentMethods[0] || 'Efectivo')
  const [calcRecordType, setCalcRecordType] = useState<'blanco' | 'x'>('blanco')
  
  // Product Search state
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  
  // Selling price handling
  const [priceRecommendationType, setPriceRecommendationType] = useState<'keep' | 'suggested' | 'manual'>('keep')
  const [customSalePrice, setCustomSalePrice] = useState('')

  // Modals state
  const [showSimulateModal, setShowSimulateModal] = useState(false)
  const [showConfirmPurchaseModal, setShowConfirmPurchaseModal] = useState(false)
  const [savingPurchase, setSavingPurchase] = useState(false)

  // Calculadora: valores derivados
  const calculation = useMemo(() => {
    const qty = Number(calcQuantity) || 0
    const unitCost = Number(calcUnitCost) || 0
    const taxRate = Number(calcTaxRate) || 0

    const subtotal = qty * unitCost
    const taxAmount = subtotal * (taxRate / 100)
    const totalWithTax = subtotal + taxAmount

    // Stock anterior y nuevo
    const currentStock = selectedProduct ? (selectedProduct.stock_quantity || 0) : 0
    const trackStock = selectedProduct ? !!selectedProduct.track_stock : false
    const newStock = trackStock ? currentStock + qty : currentStock

    // Costo anterior
    const currentCost = selectedProduct ? (selectedProduct.cost_price || 0) : 0
    const costVariation = currentCost > 0 
      ? ((unitCost - currentCost) / currentCost) * 100 
      : 0

    // Markup y Precio Sugerido
    const currentSalePrice = selectedProduct ? (selectedProduct.sale_price || 0) : 0
    
    let suggestedSalePrice = 0
    let markup = 0
    
    if (selectedProduct) {
      if (currentCost > 0) {
        markup = currentSalePrice / currentCost
        suggestedSalePrice = unitCost * markup
      } else {
        markup = 1.40
        suggestedSalePrice = unitCost * markup
      }
    }

    // Precio de venta definitivo elegido por el usuario
    let finalSalePrice = currentSalePrice
    if (priceRecommendationType === 'suggested') {
      finalSalePrice = Number(suggestedSalePrice.toFixed(2))
    } else if (priceRecommendationType === 'manual') {
      finalSalePrice = Number(customSalePrice) || 0
    }

    // Variación de precio de venta
    const salePriceVariation = currentSalePrice > 0
      ? ((finalSalePrice - currentSalePrice) / currentSalePrice) * 100
      : 0

    // Impacto de Caja y Deuda
    let cashOutflow = 0
    let providerDebt = 0

    if (calcPaymentType === 'pago_total') {
      cashOutflow = totalWithTax
      providerDebt = 0
    } else if (calcPaymentType === 'cuenta_corriente') {
      cashOutflow = 0
      providerDebt = totalWithTax
    } else if (calcPaymentType === 'pago_parcial') {
      const paid = Number(calcAmountPaid) || 0
      cashOutflow = paid
      providerDebt = Math.max(0, totalWithTax - paid)
    }

    return {
      subtotal,
      taxAmount,
      totalWithTax,
      currentStock,
      newStock,
      trackStock,
      currentCost,
      costVariation,
      currentSalePrice,
      markup,
      suggestedSalePrice,
      finalSalePrice,
      salePriceVariation,
      cashOutflow,
      providerDebt,
    }
  }, [selectedProduct, calcQuantity, calcUnitCost, calcTaxRate, priceRecommendationType, customSalePrice, calcPaymentType, calcAmountPaid])

  const filteredProducts = useMemo(() => {
    const query = productSearch.toLowerCase().trim()
    if (!query) return products.slice(0, 10)
    return products.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(query)
      const codeMatch = p.internal_code?.toLowerCase().includes(query)
      return nameMatch || codeMatch
    })
  }, [products, productSearch])

  function handleSelectProduct(product: any) {
    setSelectedProduct(product)
    setProductSearch(product.name)
    setShowProductDropdown(false)

    if (product.cost_price > 0) {
      setCalcUnitCost(product.cost_price.toString())
    } else {
      setCalcUnitCost('')
    }
    
    setPriceRecommendationType('keep')
    setCustomSalePrice('')
  }

  async function handleSavePurchase() {
    if (!selectedProduct) {
      toast.error('Debe seleccionar un producto.')
      return
    }
    if (!calcSupplierId) {
      toast.error('Debe seleccionar un proveedor.')
      return
    }
    const qty = Number(calcQuantity)
    if (isNaN(qty) || qty <= 0) {
      toast.error('La cantidad debe ser mayor a 0.')
      return
    }
    const cost = Number(calcUnitCost)
    if (isNaN(cost) || cost < 0) {
      toast.error('El costo unitario no puede ser negativo.')
      return
    }
    const tax = Number(calcTaxRate)
    if (isNaN(tax) || tax < 0) {
      toast.error('La tasa de impuesto no puede ser negativa.')
      return
    }

    const paid = calcPaymentType === 'pago_total' 
      ? calculation.totalWithTax 
      : calcPaymentType === 'cuenta_corriente' 
        ? 0 
        : Number(calcAmountPaid) || 0

    if (paid > calculation.totalWithTax) {
      toast.error('El monto pagado no puede superar el total de la compra.')
      return
    }

    if (paid > 0 && !calcPaymentMethod) {
      toast.error('Debe seleccionar un método de pago.')
      return
    }

    setSavingPurchase(true)
    try {
      const input = {
        productId: selectedProduct.id,
        supplierId: calcSupplierId,
        quantity: qty,
        unitCost: cost,
        taxRate: tax,
        operationDate: calcOperationDate,
        providerInvoice: calcInvoice.trim() || null,
        providerRemito: calcRemito.trim() || null,
        notes: calcNotes.trim() || null,
        paymentStatus: paid === calculation.totalWithTax ? 'paid' : 'pending',
        amountPaid: paid,
        paymentMethod: paid > 0 ? calcPaymentMethod : null,
        updateSalePrice: priceRecommendationType !== 'keep',
        newSalePrice: priceRecommendationType !== 'keep' ? calculation.finalSalePrice : null,
        recordType: calcRecordType,
      }

      const res = await registerSupplierPurchaseAction(input)

      if (!res.ok) {
        throw new Error(res.error)
      }

      toast.success('Compra registrada con éxito y precios/stock actualizados.')
      setShowConfirmPurchaseModal(false)

      setSelectedProduct(null)
      setProductSearch('')
      setCalcSupplierId('')
      setCalcQuantity('1')
      setCalcUnitCost('')
      setCalcInvoice('')
      setCalcRemito('')
      setCalcNotes('')
      setCalcPaymentType('pago_total')
      setCalcAmountPaid('')
      
      await loadTreasuryData()
    } catch (err: any) {
      console.error('Error al guardar la compra:', err)
      toast.error(`Error: ${err.message || 'No se pudo guardar la compra'}`)
    } finally {
      setSavingPurchase(false)
    }
  }

  useEffect(() => {
    loadTreasuryData()
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab === 'calculadora_compras') {
        setActiveTab('calculadora_compras')
      }
    }
  }, [])

  // Carga general de datos de Tesorería
  async function loadTreasuryData() {
    setLoading(true)
    try {
      // 1. Obtener balance de Caja Diario
      const { data: ledgerRes, error: ledgerErr } = await supabase
        .from('v_ledger_entries')
        .select('*')
        .eq('company_id', companyId)
        .order('entry_date', { ascending: false })

      if (ledgerErr) throw ledgerErr

      const ledger = (ledgerRes || []) as LedgerEntry[]
      setLedgerEntries(ledger)

      const totalInflows = ledger
        .filter((e) => e.entry_type === 'ingreso')
        .reduce((sum, e) => sum + Number(e.amount), 0)
      const totalOutflows = ledger
        .filter((e) => e.entry_type === 'egreso')
        .reduce((sum, e) => sum + Number(e.amount), 0)

      setCashBalance(totalInflows - totalOutflows)

      // 2. Obtener Proveedores y Calcular saldos individuales y totales
      const { data: suppliersRes, error: suppliersErr } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('name', { ascending: true })

      if (suppliersErr) throw suppliersErr

      const { data: smRes, error: smErr } = await supabase
        .from('supplier_movements')
        .select('supplier_id, debit, credit')
        .eq('company_id', companyId)

      if (smErr) throw smErr

      const movementsMap: Record<string, { debit: number; credit: number }> = {}
      ;(smRes || []).forEach((m) => {
        if (!movementsMap[m.supplier_id]) {
          movementsMap[m.supplier_id] = { debit: 0, credit: 0 }
        }
        movementsMap[m.supplier_id].debit += Number(m.debit || 0)
        movementsMap[m.supplier_id].credit += Number(m.credit || 0)
      })

      let totalPayable = 0
      const enrichedSuppliers = (suppliersRes || []).map((s) => {
        const movs = movementsMap[s.id] || { debit: 0, credit: 0 }
        const balance = movs.credit - movs.debit // credit (compra) aumenta deuda, debit (pago) reduce deuda
        if (balance > 0) {
          totalPayable += balance
        }
        return {
          ...s,
          balance,
        }
      })
      setSuppliers(enrichedSuppliers)
      setAccountsPayable(totalPayable)

      // 3. Obtener Cuentas por Cobrar (Clientes)
      const { data: clientMovRes, error: clientMovErr } = await supabase
        .from('account_movements')
        .select('debit, credit')
        .eq('company_id', companyId)

      if (clientMovErr) throw clientMovErr

      let totalReceivable = 0
      ;(clientMovRes || []).forEach((m) => {
        totalReceivable += Number(m.debit || 0) - Number(m.credit || 0)
      })
      setAccountsReceivable(totalReceivable > 0 ? totalReceivable : 0)

      // 4. Obtener productos activos para la calculadora
      const { data: productsRes, error: productsErr } = await supabase
        .from('products')
        .select('id, name, internal_code, cost_price, sale_price, stock_quantity, track_stock')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('name', { ascending: true })

      if (productsErr) throw productsErr
      setProducts(productsRes || [])
    } catch (err) {
      console.error('Error cargando tesorería:', err)
      toast.error('No se pudieron cargar los datos de tesorería.')
    } finally {
      setLoading(false)
    }
  }

  // Carga movimientos de un proveedor específico
  async function loadSupplierMovements(supplierId: string) {
    setMovementsLoading(true)
    try {
      const { data, error } = await supabase
        .from('supplier_movements')
        .select('*')
        .eq('company_id', companyId)
        .eq('supplier_id', supplierId)
        .order('movement_date', { ascending: false })

      if (error) throw error
      setSupplierMovements((data || []) as SupplierMovement[])
    } catch (err) {
      console.error('Error cargando movimientos del proveedor:', err)
      toast.error('Error al cargar la cuenta corriente.')
    } finally {
      setMovementsLoading(false)
    }
  }

  // Registrar un nuevo Proveedor
  async function handleCreateSupplier(e: React.FormEvent) {
    e.preventDefault()
    if (!newSupplierName.trim()) return

    setSavingSupplier(true)
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          company_id: companyId,
          name: newSupplierName.trim(),
          cuit: newSupplierCuit.trim() || null,
          phone: newSupplierPhone.trim() || null,
          email: newSupplierEmail.trim() || null,
          address: newSupplierAddress.trim() || null,
          active: true,
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Proveedor creado correctamente.')
      setShowSupplierModal(false)
      // Limpiar campos
      setNewSupplierName('')
      setNewSupplierCuit('')
      setNewSupplierPhone('')
      setNewSupplierEmail('')
      setNewSupplierAddress('')

      loadTreasuryData()
    } catch (err) {
      console.error('Error creando proveedor:', err)
      toast.error('No se pudo crear el proveedor.')
    } finally {
      setSavingSupplier(false)
    }
  }

  // Registrar movimiento de proveedor (Compra o Pago)
  async function handleCreateSupplierMovement(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSupplier || !movementAmount) return

    setSavingMovement(true)
    const amount = Number(movementAmount)

    try {
      const isCompra = movementModalType === 'Compra'
      const description =
        movementDescription.trim() ||
        (isCompra ? 'Compra registrada en cuenta corriente' : 'Pago a cuenta')

      if (isCompra) {
        if (purchasePaymentType === 'cuenta_corriente') {
          const { error } = await supabase.from('supplier_movements').insert({
            company_id: companyId,
            supplier_id: selectedSupplier.id,
            movement_date: movementDate,
            movement_type: 'Compra',
            description,
            debit: 0,
            credit: amount,
            payment_method: null,
          })
          if (error) throw error
        } else if (purchasePaymentType === 'pago_total') {
          const { error: compraError } = await supabase.from('supplier_movements').insert({
            company_id: companyId,
            supplier_id: selectedSupplier.id,
            movement_date: movementDate,
            movement_type: 'Compra',
            description: `Compra: ${description}`,
            debit: 0,
            credit: amount,
            payment_method: null,
          })
          if (compraError) throw compraError

          const { error: pagoError } = await supabase.from('supplier_movements').insert({
            company_id: companyId,
            supplier_id: selectedSupplier.id,
            movement_date: movementDate,
            movement_type: 'Pago',
            description: `Pago total: ${description}`,
            debit: amount,
            credit: 0,
            payment_method: purchasePaymentMethod,
          })
          if (pagoError) throw pagoError
        } else if (purchasePaymentType === 'pago_parcial') {
          const paidVal = Number(purchasePaidAmount)
          if (isNaN(paidVal) || paidVal <= 0 || paidVal > amount) {
            toast.error(`El monto pagado debe ser mayor a 0 y menor o igual a ${formatCurrency(amount)}.`)
            setSavingMovement(false)
            return
          }

          const { error: compraError } = await supabase.from('supplier_movements').insert({
            company_id: companyId,
            supplier_id: selectedSupplier.id,
            movement_date: movementDate,
            movement_type: 'Compra',
            description: `Compra: ${description}`,
            debit: 0,
            credit: amount,
            payment_method: null,
          })
          if (compraError) throw compraError

          const { error: pagoError } = await supabase.from('supplier_movements').insert({
            company_id: companyId,
            supplier_id: selectedSupplier.id,
            movement_date: movementDate,
            movement_type: 'Pago',
            description: `Pago parcial: ${description}`,
            debit: paidVal,
            credit: 0,
            payment_method: purchasePaymentMethod,
          })
          if (pagoError) throw pagoError
        }
      } else {
        const currentDebt = selectedSupplier.balance || 0
        if (amount > currentDebt) {
          toast.error(
            `El monto del pago (${formatCurrency(amount)}) no puede superar la deuda actual con el proveedor (${formatCurrency(currentDebt)}).`
          )
          setSavingMovement(false)
          return
        }

        const { error } = await supabase.from('supplier_movements').insert({
          company_id: companyId,
          supplier_id: selectedSupplier.id,
          movement_date: movementDate,
          movement_type: 'Pago',
          description,
          debit: amount,
          credit: 0,
          payment_method: selectedPaymentMethod,
        })
        if (error) throw error
      }

      toast.success('Movimiento registrado correctamente.')
      setShowMovementModal(false)
      setMovementAmount('')
      setMovementDescription('')
      setPurchasePaidAmount('')
      setPurchasePaymentType('cuenta_corriente')

      // Recargar datos
      await loadSupplierMovements(selectedSupplier.id)
      await loadTreasuryData()

      // Calcular variación neta en el saldo
      let netBalanceChange = 0
      if (isCompra) {
        if (purchasePaymentType === 'cuenta_corriente') {
          netBalanceChange = amount
        } else if (purchasePaymentType === 'pago_total') {
          netBalanceChange = 0
        } else if (purchasePaymentType === 'pago_parcial') {
          netBalanceChange = amount - Number(purchasePaidAmount)
        }
      } else {
        netBalanceChange = -amount
      }

      // Actualizar el saldo local del proveedor seleccionado
      const updatedSupplier = suppliers.find((s) => s.id === selectedSupplier.id)
      if (updatedSupplier) {
        const oldBalance = updatedSupplier.balance || 0
        const newBalance = oldBalance + netBalanceChange
        setSelectedSupplier({ ...updatedSupplier, balance: newBalance })
      }
    } catch (err) {
      console.error('Error registrando movimiento:', err)
      toast.error('No se pudo registrar el movimiento.')
    } finally {
      setSavingMovement(false)
    }
  }

  // Eliminar movimiento de proveedor
  async function handleDeleteMovement(id: string) {
    if (!selectedSupplier) return
    setDeletingId(id)
    try {
      const { error } = await supabase
        .from('supplier_movements')
        .delete()
        .eq('company_id', companyId)
        .eq('id', id)

      if (error) throw error

      toast.success('Movimiento eliminado correctamente.')
      await loadSupplierMovements(selectedSupplier.id)
      await loadTreasuryData()

      // Actualizar saldo seleccionado
      const { data: newSm } = await supabase
        .from('supplier_movements')
        .select('debit, credit')
        .eq('supplier_id', selectedSupplier.id)

      const d = (newSm || []).reduce((acc, m) => acc + Number(m.debit || 0), 0)
      const c = (newSm || []).reduce((acc, m) => acc + Number(m.credit || 0), 0)
      setSelectedSupplier({ ...selectedSupplier, balance: c - d })
    } catch (err) {
      console.error('Error eliminando movimiento:', err)
      toast.error('No se pudo eliminar el movimiento.')
    } finally {
      setDeletingId(null)
    }
  }

  // Seleccionar proveedor para ver cuenta corriente
  function handleSelectSupplier(supplier: Supplier) {
    setSelectedSupplier(supplier)
    loadSupplierMovements(supplier.id)
    setActiveTab('cuenta_proveedor')
  }

  // Formateadores
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(val)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-AR', { timeZone: 'UTC' })
  }

  async function handleExportTreasuryExcel() {
    setExportingExcel(true)
    try {
      const year = new Date().getFullYear()
      const response = await fetch(`/api/tesoreria/export-excel?year=${year}`)

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'No se pudo generar el Excel.')
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition') || ''
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
      const filename = filenameMatch?.[1] || `tesoreria-${year}.xlsx`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast.success('Excel de tesorería generado correctamente.')
    } catch (err) {
      console.error('Error exportando tesorería:', err)
      const message = err instanceof Error ? err.message : 'No se pudo exportar tesorería.'
      toast.error(message)
    } finally {
      setExportingExcel(false)
    }
  }

  // Filtrado de Libro Diario (Caja)
  const filteredLedgerEntries = useMemo(() => {
    let result = [...ledgerEntries]

    // Búsqueda por texto
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase()
      result = result.filter(
        (e) =>
          e.concept.toLowerCase().includes(q) ||
          (e.payment_method && e.payment_method.toLowerCase().includes(q))
      )
    }

    // Filtro por tipo (Ingreso / Egreso)
    if (ledgerTypeFilter !== 'all') {
      result = result.filter((e) => e.entry_type === ledgerTypeFilter)
    }

    // Filtro por días
    if (daysFilter !== 'all') {
      const days = Number(daysFilter)
      const limitDate = new Date()
      limitDate.setDate(limitDate.getDate() - days)
      result = result.filter((e) => new Date(e.entry_date) >= limitDate)
    }

    return result
  }, [ledgerEntries, ledgerSearch, ledgerTypeFilter, daysFilter])

  // Filtrado de Proveedores
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers
    const q = supplierSearch.toLowerCase()
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.cuit && s.cuit.includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q))
    )
  }, [suppliers, supplierSearch])

  // Historial acumulativo del proveedor seleccionado
  const supplierRunningBalanceMovements = useMemo(() => {
    let currentBal = 0
    // Ordenamos ascendentemente para calcular el acumulado y luego los invertimos para mostrar los más recientes arriba
    const sortedAsc = [...supplierMovements].sort(
      (a, b) => new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime()
    )
    const enriched = sortedAsc.map((m) => {
      // credit (compra) aumenta saldo deudor, debit (pago) reduce
      currentBal += Number(m.credit) - Number(m.debit)
      return {
        ...m,
        runningBalance: currentBal,
      }
    })
    return enriched.reverse()
  }, [supplierMovements])

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">
          Cargando Tesorería...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 1. SECCIÓN DE TARJETAS KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {/* Caja Actual */}
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl transition hover:shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Caja Real Neto
              </p>
              <h3 className="mt-2 text-3xl font-black text-slate-900">
                {formatCurrency(cashBalance)}
              </h3>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner">
              <Wallet size={24} />
            </div>
          </div>
          <p className="mt-4 text-xs font-bold text-slate-400">
            Diferencia neta entre cobros y pagos.
          </p>
        </div>

        {/* Deuda Clientes */}
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl transition hover:shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                A Cobrar (Clientes)
              </p>
              <h3 className="mt-2 text-3xl font-black text-blue-600">
                {formatCurrency(accountsReceivable)}
              </h3>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="mt-4 text-xs font-bold text-slate-400">
            Saldo acumulado pendiente de clientes.
          </p>
        </div>

        {/* Deuda Proveedores */}
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl transition hover:shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                A Pagar (Proveedores)
              </p>
              <h3 className="mt-2 text-3xl font-black text-rose-600">
                {formatCurrency(accountsPayable)}
              </h3>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shadow-inner">
              <TrendingDown size={24} />
            </div>
          </div>
          <p className="mt-4 text-xs font-bold text-slate-400">
            Saldo acumulado pendiente con proveedores.
          </p>
        </div>
      </div>

      {/* 2. PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('flujo_caja')}
            className={`rounded-2xl px-6 py-3.5 text-sm font-black transition-all ${
              activeTab === 'flujo_caja'
                ? 'bg-slate-900 text-white shadow-lg'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Caja Diario / Flujo
          </button>

          <button
            onClick={() => setActiveTab('proveedores')}
            className={`rounded-2xl px-6 py-3.5 text-sm font-black transition-all ${
              activeTab === 'proveedores' || activeTab === 'cuenta_proveedor'
                ? 'bg-slate-900 text-white shadow-lg'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Proveedores y Cuentas por Pagar
          </button>

          <button
            onClick={() => setActiveTab('calculadora_compras')}
            className={`rounded-2xl px-6 py-3.5 text-sm font-black transition-all ${
              activeTab === 'calculadora_compras'
                ? 'bg-slate-900 text-white shadow-lg'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Calculadora de Compras
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportTreasuryExcel}
          disabled={exportingExcel}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-xs font-black uppercase tracking-wider text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exportingExcel ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={16} />
          )}
          Exportar Excel
        </button>
      </div>

      {/* 3. CONTENIDO DE LAS PESTAÑAS */}

      {/* TAB 1: FLUJO DE CAJA (LIBRO DIARIO) */}
      {activeTab === 'flujo_caja' && (
        <div className="space-y-6">
          {/* Barra de filtros */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Buscar por concepto o método..."
                value={ledgerSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {/* Filtro por tipo de movimiento */}
              <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  onClick={() => setLedgerTypeFilter('all')}
                  className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                    ledgerTypeFilter === 'all'
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setLedgerTypeFilter('ingreso')}
                  className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                    ledgerTypeFilter === 'ingreso'
                      ? 'bg-emerald-50 text-emerald-700 font-black'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Ingresos
                </button>
                <button
                  onClick={() => setLedgerTypeFilter('egreso')}
                  className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                    ledgerTypeFilter === 'egreso'
                      ? 'bg-rose-50 text-rose-700 font-black'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Egresos
                </button>
              </div>

              {/* Filtro por fecha */}
              <div className="flex gap-2">
                <FilterButton
                  active={daysFilter === 'all'}
                  onClick={() => setDaysFilter('all')}
                >
                  Histórico
                </FilterButton>
                <FilterButton
                  active={daysFilter === '7'}
                  onClick={() => setDaysFilter('7')}
                >
                  7 días
                </FilterButton>
                <FilterButton
                  active={daysFilter === '30'}
                  onClick={() => setDaysFilter('30')}
                >
                  30 días
                </FilterButton>
              </div>
            </div>
          </div>

          {/* Tabla de Libro Diario */}
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-black uppercase tracking-widest text-slate-400">
                    <th className="px-8 py-5">Fecha</th>
                    <th className="px-8 py-5">Concepto / Detalle</th>
                    <th className="px-8 py-5 text-center">Tipo</th>
                    <th className="px-8 py-5">Método de Pago</th>
                    <th className="px-8 py-5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center">
                        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">
                          No se encontraron registros de caja.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredLedgerEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="group text-sm font-bold text-slate-800 transition hover:bg-slate-50/50"
                      >
                        <td className="whitespace-nowrap px-8 py-5 text-slate-500 font-mono">
                          {formatDate(entry.entry_date)}
                        </td>
                        <td className="px-8 py-5 font-black text-slate-900">
                          {entry.concept}
                        </td>
                        <td className="whitespace-nowrap px-8 py-5 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
                              entry.entry_type === 'ingreso'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {entry.entry_type === 'ingreso' ? (
                              <ArrowDownCircle size={14} />
                            ) : (
                              <ArrowUpCircle size={14} />
                            )}
                            {entry.entry_type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-8 py-5 text-slate-500">
                          {entry.payment_method || 'Sin especificar'}
                        </td>
                        <td
                          className={`whitespace-nowrap px-8 py-5 text-right font-black text-base ${
                            entry.entry_type === 'ingreso'
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {entry.entry_type === 'ingreso' ? '+' : '-'}
                          {formatCurrency(entry.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROVEEDORES */}
      {activeTab === 'proveedores' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Buscar proveedor..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => setShowSupplierModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
            >
              <Plus size={18} />
              Nuevo Proveedor
            </button>
          </div>

          {/* Lista de Proveedores */}
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-black uppercase tracking-widest text-slate-400">
                    <th className="px-8 py-5">Nombre / Razón Social</th>
                    <th className="px-8 py-5">CUIT</th>
                    <th className="px-8 py-5">Contacto</th>
                    <th className="px-8 py-5 text-right">Saldo Deuda</th>
                    <th className="px-8 py-5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center">
                        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">
                          No se encontraron proveedores.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((supplier) => {
                      const bal = supplier.balance || 0
                      return (
                        <tr
                          key={supplier.id}
                          className="group text-sm font-bold text-slate-800 transition hover:bg-slate-50/50"
                        >
                          <td className="px-8 py-5">
                            <p className="font-black text-slate-900 text-base">
                              {supplier.name}
                            </p>
                            {supplier.address && (
                              <p className="text-xs font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
                                <MapPin size={12} /> {supplier.address}
                              </p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-8 py-5 text-slate-500 font-mono">
                            {supplier.cuit || 'Sin CUIT'}
                          </td>
                          <td className="px-8 py-5">
                            <div className="space-y-0.5 text-xs text-slate-500 font-semibold">
                              {supplier.phone && (
                                <p className="flex items-center gap-1">
                                  <Phone size={12} /> {supplier.phone}
                                </p>
                              )}
                              {supplier.email && (
                                <p className="flex items-center gap-1">
                                  <Mail size={12} /> {supplier.email}
                                </p>
                              )}
                              {!supplier.phone && !supplier.email && (
                                <span className="text-slate-400 font-medium">Sin contacto</span>
                              )}
                            </div>
                          </td>
                          <td
                            className={`whitespace-nowrap px-8 py-5 text-right font-black text-base ${
                              bal > 0 ? 'text-rose-600' : 'text-slate-500'
                            }`}
                          >
                            {formatCurrency(bal)}
                          </td>
                          <td className="whitespace-nowrap px-8 py-5 text-center">
                            <button
                              onClick={() => handleSelectSupplier(supplier)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-slate-350 hover:bg-slate-50"
                            >
                              Ver Cuenta Corriente
                              <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUENTA CORRIENTE DE PROVEEDOR (DETALLE) */}
      {activeTab === 'cuenta_proveedor' && selectedSupplier && (
        <div className="space-y-6">
          {/* Encabezado e info de proveedor */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveTab('proveedores')}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Cuenta Corriente
                </span>
                <h2 className="text-2xl font-black text-slate-900">
                  {selectedSupplier.name}
                </h2>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMovementModalType('Compra')
                  setShowMovementModal(true)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-100"
              >
                <TrendingDown size={18} />
                Registrar Compra / Deuda
              </button>

              <button
                onClick={() => {
                  setMovementModalType('Pago')
                  setShowMovementModal(true)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
              >
                <CreditCard size={18} />
                Registrar Pago
              </button>
            </div>
          </div>

          {/* Resumen de saldo del proveedor */}
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">
                CUIT: <span className="font-mono">{selectedSupplier.cuit || 'Sin CUIT'}</span>
              </p>
              <p className="text-xs font-bold text-slate-500">
                Dirección: <span>{selectedSupplier.address || 'Sin dirección'}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Saldo Deudor Actual
              </p>
              <p
                className={`text-2xl font-black mt-1 ${
                  (selectedSupplier.balance || 0) > 0 ? 'text-rose-600' : 'text-slate-600'
                }`}
              >
                {formatCurrency(selectedSupplier.balance || 0)}
              </p>
            </div>
          </div>

          {/* Tabla de Movimientos del Proveedor */}
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
            {movementsLoading ? (
              <div className="flex h-48 items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                  Cargando movimientos...
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-black uppercase tracking-widest text-slate-400">
                      <th className="px-8 py-5">Fecha</th>
                      <th className="px-8 py-5">Descripción</th>
                      <th className="px-8 py-5 text-right">Compra (Haber)</th>
                      <th className="px-8 py-5 text-right">Pago (Debe)</th>
                      <th className="px-8 py-5 text-right">Saldo Acumulado</th>
                      <th className="px-8 py-5 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {supplierRunningBalanceMovements.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-8 py-16 text-center">
                          <p className="text-sm font-black text-slate-400 uppercase tracking-wider">
                            No hay movimientos registrados en esta cuenta.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      supplierRunningBalanceMovements.map((movement) => (
                        <tr
                          key={movement.id}
                          className="group text-sm font-bold text-slate-800 transition hover:bg-slate-50/50"
                        >
                          <td className="whitespace-nowrap px-8 py-5 text-slate-500 font-mono">
                            {formatDate(movement.movement_date)}
                          </td>
                          <td className="px-8 py-5">
                            <p className="font-black text-slate-900">
                              {movement.description}
                            </p>
                            {movement.payment_method && (
                              <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                {movement.payment_method}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-8 py-5 text-right text-rose-600 font-black">
                            {movement.credit > 0 ? `+${formatCurrency(movement.credit)}` : '-'}
                          </td>
                          <td className="whitespace-nowrap px-8 py-5 text-right text-emerald-600 font-black">
                            {movement.debit > 0 ? `-${formatCurrency(movement.debit)}` : '-'}
                          </td>
                          <td className="whitespace-nowrap px-8 py-5 text-right font-black">
                            {formatCurrency(movement.runningBalance)}
                          </td>
                          <td className="whitespace-nowrap px-8 py-5 text-center">
                            <button
                              onClick={() => handleDeleteMovement(movement.id)}
                              disabled={deletingId === movement.id}
                              className="text-slate-400 hover:text-rose-600 transition disabled:opacity-50"
                              title="Eliminar movimiento"
                            >
                              {deletingId === movement.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* MODAL NUEVOR PROVEEDOR */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-2xl transition-all animate-in zoom-in-95">
            <h2 className="text-2xl font-black text-slate-900">Nuevo Proveedor</h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Registrá una nueva entidad proveedora para su cuenta corriente.
            </p>

            <form onSubmit={handleCreateSupplier} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                  Razón Social / Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white"
                  placeholder="Ej: Distribuidora Sol S.A."
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                  CUIT / Identificación
                </label>
                <input
                  type="text"
                  value={newSupplierCuit}
                  onChange={(e) => setNewSupplierCuit(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white"
                  placeholder="Ej: 30-71234567-8"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white"
                    placeholder="Ej: 11 5555 5555"
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newSupplierEmail}
                    onChange={(e) => setNewSupplierEmail(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white"
                    placeholder="Ej: ventas@proveedor.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                  Dirección
                </label>
                <input
                  type="text"
                  value={newSupplierAddress}
                  onChange={(e) => setNewSupplierAddress(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white"
                  placeholder="Ej: Av. Rivadavia 1234, CABA"
                />
              </div>

              <div className="mt-8 flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSupplier}
                  className="flex-1 rounded-2xl bg-blue-600 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {savingSupplier ? (
                    <Loader2 size={18} className="animate-spin mx-auto" />
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR MOVIMIENTO (COMPRA O PAGO) */}
      {showMovementModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-2xl transition-all animate-in zoom-in-95">
            <h2 className="text-2xl font-black text-slate-900">
              {movementModalType === 'Compra' ? 'Registrar Compra / Gasto' : 'Registrar Pago'}
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Registrar transacción en la cuenta corriente de{' '}
              <span className="font-extrabold text-slate-600">{selectedSupplier.name}</span>.
            </p>

            <form onSubmit={handleCreateSupplierMovement} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                  Monto ($) *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  max={movementModalType === 'Pago' ? (selectedSupplier.balance || 0) : undefined}
                  value={movementAmount}
                  onChange={(e) => {
                    setMovementAmount(e.target.value)
                    if (purchasePaymentType === 'pago_total') {
                      setPurchasePaidAmount(e.target.value)
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                  Fecha *
                </label>
                <input
                  type="date"
                  required
                  value={movementDate}
                  onChange={(e) => setMovementDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>

              {movementModalType === 'Compra' && (
                <>
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                      Condición de Pago
                    </label>
                    <select
                      value={purchasePaymentType}
                      onChange={(e) => {
                        const val = e.target.value as any
                        setPurchasePaymentType(val)
                        if (val === 'pago_total') {
                          setPurchasePaidAmount(movementAmount)
                        } else {
                          setPurchasePaidAmount('')
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-black text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                    >
                      <option value="cuenta_corriente">A Cuenta Corriente (100% Crédito)</option>
                      <option value="pago_total">Pago Total (100% Contado)</option>
                      <option value="pago_parcial">Pago Parcial</option>
                    </select>
                  </div>

                  {purchasePaymentType === 'pago_parcial' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                        Monto Pagado ($) *
                      </label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0.01"
                        max={movementAmount}
                        value={purchasePaidAmount}
                        onChange={(e) => setPurchasePaidAmount(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white"
                        placeholder="0.00"
                      />
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">
                        El monto restante se registrará como saldo deudor.
                      </p>
                    </div>
                  )}

                  {(purchasePaymentType === 'pago_total' || purchasePaymentType === 'pago_parcial') && (
                    <div className="animate-in fade-in duration-200">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                        Método de Pago
                      </label>
                      <select
                        value={purchasePaymentMethod}
                        onChange={(e) => setPurchasePaymentMethod(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-black text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                      >
                        {initialPaymentMethods.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {movementModalType === 'Pago' && (
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                    Método de Pago
                  </label>
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-black text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  >
                    {initialPaymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                  Detalle / Descripción
                </label>
                <input
                  type="text"
                  value={movementDescription}
                  onChange={(e) => setMovementDescription(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white"
                  placeholder={
                    movementModalType === 'Compra'
                      ? 'Ej: Compra de materia prima Factura A-12'
                      : 'Ej: Transferencia bancaria'
                  }
                />
              </div>

              <div className="mt-8 flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMovement}
                  className={`flex-1 rounded-2xl py-3.5 text-sm font-black text-white shadow-lg transition disabled:opacity-50 ${
                    movementModalType === 'Compra'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                  }`}
                >
                  {savingMovement ? (
                    <Loader2 size={18} className="animate-spin mx-auto" />
                  ) : (
                    'Registrar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: CALCULADORA DE COMPRAS */}
      {activeTab === 'calculadora_compras' && (
        <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in duration-300">
          
          {/* PANEL DE FORMULARIO DE COMPRA (2 Columnas en lg) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Settings2 size={20} className="text-blue-600" />
                  Calculadora & Registro de Compra
                </h2>
                {selectedProduct && (
                  <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 animate-pulse">
                    Modo Simulación Activo
                  </span>
                )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                
                {/* Seleccionar Producto */}
                <div className="relative space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1">
                    Seleccionar Producto *
                  </label>
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar producto por nombre o código..."
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value)
                        setShowProductDropdown(true)
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3.5 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  {showProductDropdown && (
                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {filteredProducts.length === 0 ? (
                        <div className="p-4 text-xs text-slate-500 font-bold text-center">
                          No se encontraron productos activos.
                        </div>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectProduct(p)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition border-b border-slate-100 last:border-0 cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                              <p className="text-[10px] text-slate-400 font-semibold truncate">
                                {p.internal_code ? `Código: ${p.internal_code}` : 'Sin código'}
                              </p>
                            </div>
                            <div className="text-right pl-4">
                              <p className="text-xs font-black text-blue-700">
                                Costo: {formatCurrency(p.cost_price || 0)}
                              </p>
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                                Stock: {p.stock_quantity ?? 0}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Seleccionar Proveedor */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1">
                    Seleccionar Proveedor *
                  </label>
                  <select
                    value={calcSupplierId}
                    onChange={(e) => setCalcSupplierId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  >
                    <option value="">-- Seleccionar Proveedor --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.cuit ? `(CUIT: ${s.cuit})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Costo Unitario Neto */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1">
                    Costo Unitario Neto * <span className="text-[10px] text-slate-400 normal-case">(Sin IVA)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={calcUnitCost}
                    onChange={(e) => setCalcUnitCost(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>

                {/* Cantidad a Comprar */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={calcQuantity}
                    onChange={(e) => setCalcQuantity(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>

                {/* Alícuota de IVA */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1">
                    Tasa de Impuesto / IVA
                  </label>
                  <select
                    value={calcTaxRate}
                    onChange={(e) => setCalcTaxRate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-black text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  >
                    <option value="0">0% (Exento)</option>
                    <option value="10.5">10.5% (IVA Reducido)</option>
                    <option value="21">21% (IVA General)</option>
                    <option value="27">27% (IVA Especial)</option>
                  </select>
                </div>

                {/* Fecha Operación */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1">
                    Fecha de Operación
                  </label>
                  <input
                    type="date"
                    value={calcOperationDate}
                    onChange={(e) => setCalcOperationDate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>

                {/* Nro Factura Proveedor */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1">
                    Factura Proveedor
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: A-0001-00001234"
                    value={calcInvoice}
                    onChange={(e) => setCalcInvoice(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>

                {/* Nro Remito Proveedor */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1">
                    Remito Proveedor
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 0001-00004567"
                    value={calcRemito}
                    onChange={(e) => setCalcRemito(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Notas de Operación */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1">
                  Notas / Observaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles adicionales sobre la entrega, descuentos especiales..."
                  value={calcNotes}
                  onChange={(e) => setCalcNotes(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white resize-none"
                />
              </div>

              {/* CONDICIONES DE PAGO */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Condición de Pago & Financiación
                </h3>
                
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Condición
                    </label>
                    <select
                      value={calcPaymentType}
                      onChange={(e) => {
                        const val = e.target.value as any
                        setCalcPaymentType(val)
                        if (val === 'pago_total') {
                          setCalcAmountPaid(calculation.totalWithTax.toFixed(2))
                        } else {
                          setCalcAmountPaid('')
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-black text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                    >
                      <option value="pago_total">Pago Total (100% Contado)</option>
                      <option value="cuenta_corriente">Cuenta Corriente (100% Crédito)</option>
                      <option value="pago_parcial">Pago Parcial (Contado + Crédito)</option>
                    </select>
                  </div>

                  {calcPaymentType === 'pago_parcial' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                        Monto Pagado ($) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={calculation.totalWithTax}
                        placeholder="0.00"
                        value={calcAmountPaid}
                        onChange={(e) => setCalcAmountPaid(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  )}

                  {calcPaymentType !== 'cuenta_corriente' && (
                    <div className="space-y-2 animate-in fade-in duration-200">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                        Método de Pago
                      </label>
                      <select
                        value={calcPaymentMethod}
                        onChange={(e) => setCalcPaymentMethod(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-black text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                      >
                        {initialPaymentMethods.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <RecordTypeSelector value={calcRecordType} onChange={setCalcRecordType} />
                </div>
              </div>
            </div>

            {/* PANEL DE MÁRGENES Y PRECIO DE VENTA */}
            {selectedProduct && (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
                <h3 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3">
                  Estrategia y Precio de Venta
                </h3>

                <div className="grid gap-5 md:grid-cols-3">
                  
                  {/* Mantener precio actual */}
                  <button
                    type="button"
                    onClick={() => setPriceRecommendationType('keep')}
                    className={`rounded-2xl border p-4 text-left transition cursor-pointer flex flex-col justify-between ${
                      priceRecommendationType === 'keep'
                        ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-400">Mantener Precio</h4>
                      <p className="mt-1 text-lg font-black text-slate-900">
                        {formatCurrency(calculation.currentSalePrice)}
                      </p>
                    </div>
                    <p className="mt-4 text-[10px] text-slate-400 font-bold">
                      No modifica el precio actual del producto.
                    </p>
                  </button>

                  {/* Aceptar Precio Sugerido */}
                  <button
                    type="button"
                    onClick={() => setPriceRecommendationType('suggested')}
                    className={`rounded-2xl border p-4 text-left transition cursor-pointer flex flex-col justify-between ${
                      priceRecommendationType === 'suggested'
                        ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-black uppercase text-blue-700">Precio Sugerido</h4>
                      <p className="mt-1 text-lg font-black text-blue-900">
                        {formatCurrency(calculation.suggestedSalePrice)}
                      </p>
                    </div>
                    <p className="mt-4 text-[10px] text-slate-500 font-bold leading-normal">
                      Mantiene el markup actual de{' '}
                      <span className="font-extrabold text-blue-800">
                        {calculation.markup > 0 ? `${((calculation.markup - 1) * 100).toFixed(1)}%` : '40.0%'}
                      </span>
                    </p>
                  </button>

                  {/* Modificación manual */}
                  <button
                    type="button"
                    onClick={() => setPriceRecommendationType('manual')}
                    className={`rounded-2xl border p-4 text-left transition cursor-pointer flex flex-col justify-between ${
                      priceRecommendationType === 'manual'
                        ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-400">Personalizado</h4>
                      <div className="mt-1">
                        <input
                          type="number"
                          placeholder="Monto"
                          value={customSalePrice}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            setCustomSalePrice(e.target.value)
                            setPriceRecommendationType('manual')
                          }}
                          className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 text-lg outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <p className="mt-4 text-[10px] text-slate-400 font-bold">
                      Establecer un precio de venta fijo personalizado.
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* PANEL DE VISTA PREVIA Y ACCIONES (1 Columna en lg) */}
          <div className="space-y-6">
            
            {/* CARD DE TOTALES */}
            <div className="rounded-[2rem] border border-slate-200 bg-slate-900 p-6 text-white shadow-lg space-y-6">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">
                Resumen de Operación
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between text-sm font-bold text-slate-300">
                  <span>Subtotal Neto</span>
                  <span>{formatCurrency(calculation.subtotal)}</span>
                </div>
                
                <div className="flex justify-between text-sm font-bold text-slate-300">
                  <span>Impuestos (IVA {calcTaxRate}%)</span>
                  <span>{formatCurrency(calculation.taxAmount)}</span>
                </div>

                <div className="border-t border-slate-800 pt-4 flex justify-between items-baseline">
                  <span className="text-base font-black text-slate-200">Total Facturado</span>
                  <span className="text-2xl font-black text-white">
                    {formatCurrency(calculation.totalWithTax)}
                  </span>
                </div>
              </div>

              {/* DETALLES DE EGRESO Y DEUDA */}
              <div className="rounded-2xl bg-slate-800/40 p-4 space-y-3.5 text-xs font-bold border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Egreso inmediato de Caja:</span>
                  <span className="text-rose-400">{formatCurrency(calculation.cashOutflow)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Deuda generada (Proveedor):</span>
                  <span className="text-amber-400">{formatCurrency(calculation.providerDebt)}</span>
                </div>
              </div>

              {/* ACCIONES */}
              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(true)}
                  disabled={!selectedProduct}
                  className="w-full rounded-2xl border border-slate-700 bg-transparent py-4 text-sm font-black text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                >
                  Simular Compra
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedProduct) {
                      toast.error('Debe seleccionar un producto.')
                      return
                    }
                    if (!calcSupplierId) {
                      toast.error('Debe seleccionar un proveedor.')
                      return
                    }
                    setShowConfirmPurchaseModal(true)
                  }}
                  disabled={!selectedProduct || !calcSupplierId}
                  className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-black text-white hover:bg-blue-500 transition shadow-lg shadow-blue-900/30 disabled:opacity-30 disabled:hover:bg-blue-600 cursor-pointer"
                >
                  Guardar Compra Real
                </button>
              </div>
            </div>

            {/* SIMULACIÓN DE IMPACTOS */}
            {selectedProduct && (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Impactos Proyectados
                </h3>

                <div className="space-y-4">
                  {/* Stock */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400">Stock Proyectado</p>
                      <p className="text-sm font-black text-slate-800 mt-0.5">
                        {calculation.currentStock} → <span className="text-blue-600 font-extrabold">{calculation.newStock}</span> uds
                      </p>
                    </div>
                    {!calculation.trackStock && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                        Stock no activo
                      </span>
                    )}
                  </div>

                  {/* Costo del Producto */}
                  <div>
                    <p className="text-xs font-bold text-slate-400">Variación de Costo</p>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <p className="text-sm font-black text-slate-800">
                        {formatCurrency(calculation.currentCost)} → {formatCurrency(Number(calcUnitCost) || 0)}
                      </p>
                      {calculation.costVariation !== 0 && (
                        <span className={`text-[10px] font-black ${calculation.costVariation > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          ({calculation.costVariation > 0 ? '+' : ''}{calculation.costVariation.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Precio de Venta */}
                  <div>
                    <p className="text-xs font-bold text-slate-400">Precio de Venta</p>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <p className="text-sm font-black text-slate-800">
                        {formatCurrency(calculation.currentSalePrice)} → {formatCurrency(calculation.finalSalePrice)}
                      </p>
                      {calculation.salePriceVariation !== 0 && (
                        <span className={`text-[10px] font-black ${calculation.salePriceVariation > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ({calculation.salePriceVariation > 0 ? '+' : ''}{calculation.salePriceVariation.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE SIMULACIÓN */}
      {showSimulateModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-2xl transition-all animate-in zoom-in-95">
            <h2 className="text-2xl font-black text-slate-900">Simulación de Compra</h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Breakdown consolidado de costos y márgenes proyectados.
            </p>

            <div className="mt-6 space-y-4 rounded-3xl bg-slate-50 p-5 text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500">Producto:</span>
                <span className="font-black text-slate-800">{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500">Cantidad:</span>
                <span className="font-black text-slate-800">{calcQuantity} unidades</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500">Costo Unitario Neto:</span>
                <span className="font-black text-slate-800">{formatCurrency(Number(calcUnitCost) || 0)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500">IVA Aplicado:</span>
                <span className="font-black text-slate-800">{calcTaxRate}% ({formatCurrency(calculation.taxAmount)})</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500">Costo Neto Total:</span>
                <span className="font-black text-slate-800">{formatCurrency(calculation.subtotal)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500">Total con Impuestos:</span>
                <span className="font-black text-blue-700">{formatCurrency(calculation.totalWithTax)}</span>
              </div>
              
              <div className="pt-2">
                <h4 className="text-xs font-black uppercase text-slate-400 mb-2">Estrategia de Venta</h4>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-500">Nuevo Costo:</span>
                  <span className="font-black text-slate-800">{formatCurrency(Number(calcUnitCost) || 0)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-500">Nuevo Precio Venta:</span>
                  <span className="font-black text-emerald-700">{formatCurrency(calculation.finalSalePrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Ganancia Estimada:</span>
                  <span className="font-black text-slate-800">
                    {formatCurrency(calculation.finalSalePrice - (Number(calcUnitCost) || 0))} (
                    {Number(calcUnitCost) > 0 
                      ? `${(((calculation.finalSalePrice / (Number(calcUnitCost) || 1)) - 1) * 100).toFixed(1)}%` 
                      : '0%'
                    } margen)
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="w-full sm:w-auto rounded-2xl bg-slate-900 py-3.5 px-6 text-sm font-black text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Cerrar Simulación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE COMPRA REAL */}
      {showConfirmPurchaseModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-2xl transition-all animate-in zoom-in-95">
            <h2 className="text-2xl font-black text-slate-900">Confirmar Registro Real</h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Revisá los detalles de la compra. Esta operación impactará en el stock y las cuentas de la empresa.
            </p>

            {/* ADVERTENCIAS */}
            <div className="mt-6 space-y-3">
              {calculation.costVariation >= 30 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-xs text-amber-800 font-bold leading-normal">
                  <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                  <div>
                    <span className="font-extrabold block">Alerta de Variación de Costo</span>
                    El costo del producto subió un {calculation.costVariation.toFixed(1)}% respecto al anterior.
                  </div>
                </div>
              )}

              {calculation.finalSalePrice < (Number(calcUnitCost) || 0) && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex gap-3 text-xs text-rose-800 font-bold leading-normal">
                  <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                  <div>
                    <span className="font-extrabold block">Pérdida en Venta</span>
                    El nuevo precio de venta ({formatCurrency(calculation.finalSalePrice)}) es menor al nuevo costo unitario ({formatCurrency(Number(calcUnitCost) || 0)}).
                  </div>
                </div>
              )}

              {!calculation.trackStock && (
                <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 flex gap-3 text-xs text-slate-700 font-bold leading-normal">
                  <HelpCircle className="text-slate-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <span className="font-extrabold block">Stock Inactivo</span>
                    El producto no tiene configurado el control de stock. No se registrará movimiento de inventario.
                  </div>
                </div>
              )}

              {!calcInvoice && !calcRemito && (
                <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 flex gap-3 text-xs text-slate-700 font-bold leading-normal">
                  <HelpCircle className="text-slate-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <span className="font-extrabold block">Sin Comprobante</span>
                    No se especificó Factura ni Remito de proveedor para esta compra.
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-3 rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-600">
              <div className="flex justify-between">
                <span>Producto:</span>
                <span className="font-black text-slate-800">{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Compra:</span>
                <span className="font-black text-slate-800">{formatCurrency(calculation.totalWithTax)}</span>
              </div>
              <div className="flex justify-between">
                <span>Condición de Pago:</span>
                <span className="font-black text-slate-800">
                  {calcPaymentType === 'pago_total' ? 'Pago Total Contado' : calcPaymentType === 'cuenta_corriente' ? 'A Cuenta Corriente' : 'Pago Parcial'}
                </span>
              </div>
              {calcPaymentType !== 'cuenta_corriente' && (
                <div className="flex justify-between">
                  <span>Monto Pagado Hoy:</span>
                  <span className="font-black text-rose-600">{formatCurrency(calculation.cashOutflow)} ({calcPaymentMethod})</span>
                </div>
              )}
              {calculation.providerDebt > 0 && (
                <div className="flex justify-between">
                  <span>Deuda a Cuenta Corriente:</span>
                  <span className="font-black text-amber-600">{formatCurrency(calculation.providerDebt)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-3">
                <span>Precio Venta Actualizado:</span>
                <span className="font-black text-slate-800">
                  {priceRecommendationType === 'keep' ? 'Sin Cambios' : formatCurrency(calculation.finalSalePrice)}
                </span>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmPurchaseModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-sm font-black text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePurchase}
                disabled={savingPurchase}
                className="flex-1 rounded-2xl bg-blue-600 py-3.5 text-sm font-black text-white hover:bg-blue-500 transition disabled:opacity-50 cursor-pointer"
              >
                {savingPurchase ? (
                  <Loader2 size={18} className="animate-spin mx-auto" />
                ) : (
                  'Confirmar y Guardar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
