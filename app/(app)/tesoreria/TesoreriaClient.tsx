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
  const [activeTab, setActiveTab] = useState<'flujo_caja' | 'proveedores' | 'cuenta_proveedor'>('flujo_caja')
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    loadTreasuryData()
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
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
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
                              bal > 0 ? 'text-rose-600' : bal < 0 ? 'text-emerald-600' : 'text-slate-500'
                            }`}
                          >
                            {bal < 0 ? `${formatCurrency(Math.abs(bal))} (A favor)` : formatCurrency(bal)}
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
                {(selectedSupplier.balance || 0) < 0 ? 'Saldo a Favor Actual' : 'Saldo Deudor Actual'}
              </p>
              <p
                className={`text-2xl font-black mt-1 ${
                  (selectedSupplier.balance || 0) > 0
                    ? 'text-rose-600'
                    : (selectedSupplier.balance || 0) < 0
                    ? 'text-emerald-600'
                    : 'text-slate-600'
                }`}
              >
                {(selectedSupplier.balance || 0) < 0
                  ? formatCurrency(Math.abs(selectedSupplier.balance || 0))
                  : formatCurrency(selectedSupplier.balance || 0)}
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
                          <td className={`whitespace-nowrap px-8 py-5 text-right font-black ${
                            movement.runningBalance > 0 ? 'text-rose-600' : movement.runningBalance < 0 ? 'text-emerald-600' : 'text-slate-800'
                          }`}>
                            {movement.runningBalance < 0
                              ? `${formatCurrency(Math.abs(movement.runningBalance))} (A favor)`
                              : formatCurrency(movement.runningBalance)}
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
    </div>
  )
}
