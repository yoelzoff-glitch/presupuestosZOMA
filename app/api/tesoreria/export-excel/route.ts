import { type NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LedgerEntry = {
  id: string
  entry_date: string
  entry_type: 'ingreso' | 'egreso'
  concept: string | null
  amount: number | string | null
  payment_method: string | null
  created_at: string | null
  source_table?: string | null
  source_id?: string | null
}

type Supplier = {
  id: string
  name: string
  cuit: string | null
  phone: string | null
  email: string | null
  address: string | null
  active: boolean | null
}

type SupplierMovement = {
  id: string
  supplier_id: string
  movement_date: string
  movement_type: 'Compra' | 'Pago'
  payment_method: string | null
  description: string | null
  debit: number | string | null
  credit: number | string | null
  created_at: string | null
}

type AccountMovement = {
  id: string
  client_id: string
  movement_date: string
  movement_type: string
  payment_type: string | null
  payment_method: string | null
  description: string | null
  debit: number | string | null
  credit: number | string | null
  created_at: string | null
  client?: { name: string | null; cuit: string | null } | null
}

type Purchase = {
  id: string
  product_name: string
  product_code: string | null
  supplier: string | null
  supplier_id: string | null
  quantity: number | string | null
  unit_cost: number | string | null
  total_cost: number | string | null
  total_with_tax?: number | string | null
  tax_amount?: number | string | null
  purchase_date: string
  provider_invoice: string | null
  provider_remito?: string | null
  payment_method: string | null
  payment_status: string | null
  amount_paid: number | string | null
  notes: string | null
}

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value || 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const [date] = value.split('T')
  return date
}

function sheetFromRows(rows: unknown[][], columnWidths: number[]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = columnWidths.map((wch) => ({ wch }))
  return sheet
}

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: unknown[][], widths: number[]) {
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(rows, widths), name)
}

function monthIndexFromDate(date: string) {
  const month = Number(date.slice(5, 7))
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month - 1 : -1
}

function buildFilename(companyName: string, year: string) {
  const cleanCompany = (companyName || 'empresa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  const today = new Date().toISOString().slice(0, 10)
  return `tesoreria-${cleanCompany}-${year}-${today}.xlsx`
}

export async function GET(request: NextRequest) {
  const context = await getServerUserContext()
  if (!context) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const year = request.nextUrl.searchParams.get('year') || String(new Date().getFullYear())
  const from = request.nextUrl.searchParams.get('from') || `${year}-01-01`
  const to = request.nextUrl.searchParams.get('to') || `${year}-12-31`

  if (from > to) {
    return NextResponse.json({ error: 'El rango de fechas no es valido' }, { status: 400 })
  }

  const supabase = await createServerComponentClient()
  const companyId = context.idEmpresa

  const [
    ledgerResult,
    suppliersResult,
    supplierMovementsResult,
    accountMovementsResult,
    purchasesResult,
  ] = await Promise.all([
    supabase
      .from('v_ledger_entries')
      .select('*')
      .eq('company_id', companyId)
      .gte('entry_date', from)
      .lte('entry_date', to)
      .order('entry_date', { ascending: true }),
    supabase
      .from('suppliers')
      .select('id, name, cuit, phone, email, address, active')
      .eq('company_id', companyId)
      .order('name', { ascending: true }),
    supabase
      .from('supplier_movements')
      .select('*')
      .eq('company_id', companyId)
      .gte('movement_date', from)
      .lte('movement_date', to)
      .order('movement_date', { ascending: true }),
    supabase
      .from('account_movements')
      .select('*, client:clients(name, cuit)')
      .eq('company_id', companyId)
      .gte('movement_date', from)
      .lte('movement_date', to)
      .order('movement_date', { ascending: true }),
    supabase
      .from('purchases')
      .select('*')
      .eq('company_id', companyId)
      .gte('purchase_date', from)
      .lte('purchase_date', to)
      .order('purchase_date', { ascending: true }),
  ])

  const firstError =
    ledgerResult.error ||
    suppliersResult.error ||
    supplierMovementsResult.error ||
    accountMovementsResult.error ||
    purchasesResult.error

  if (firstError) {
    console.error('Error exportando tesoreria:', firstError)
    return NextResponse.json({ error: 'No se pudo generar el Excel de tesoreria' }, { status: 500 })
  }

  const ledger = (ledgerResult.data || []) as LedgerEntry[]
  const suppliers = (suppliersResult.data || []) as Supplier[]
  const supplierMovements = (supplierMovementsResult.data || []) as SupplierMovement[]
  const accountMovements = (accountMovementsResult.data || []) as AccountMovement[]
  const purchases = (purchasesResult.data || []) as Purchase[]

  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]))

  const totalIngresos = ledger
    .filter((entry) => entry.entry_type === 'ingreso')
    .reduce((sum, entry) => sum + toNumber(entry.amount), 0)

  const totalEgresos = ledger
    .filter((entry) => entry.entry_type === 'egreso')
    .reduce((sum, entry) => sum + toNumber(entry.amount), 0)

  const totalComprasProveedor = supplierMovements.reduce((sum, movement) => sum + toNumber(movement.credit), 0)
  const totalPagosProveedor = supplierMovements.reduce((sum, movement) => sum + toNumber(movement.debit), 0)
  const cuentasPorCobrar = accountMovements.reduce(
    (sum, movement) => sum + toNumber(movement.debit) - toNumber(movement.credit),
    0
  )

  const monthly = MONTHS.map((month) => ({
    month,
    ingresos: 0,
    egresos: 0,
    cantidadIngresos: 0,
    cantidadEgresos: 0,
  }))

  for (const entry of ledger) {
    const index = monthIndexFromDate(entry.entry_date)
    if (index < 0) continue
    if (entry.entry_type === 'ingreso') {
      monthly[index].ingresos += toNumber(entry.amount)
      monthly[index].cantidadIngresos += 1
    } else {
      monthly[index].egresos += toNumber(entry.amount)
      monthly[index].cantidadEgresos += 1
    }
  }

  const supplierTotals = suppliers.map((supplier) => {
    const movements = supplierMovements.filter((movement) => movement.supplier_id === supplier.id)
    const compras = movements.reduce((sum, movement) => sum + toNumber(movement.credit), 0)
    const pagos = movements.reduce((sum, movement) => sum + toNumber(movement.debit), 0)
    return {
      supplier,
      compras,
      pagos,
      saldo: compras - pagos,
      movimientos: movements.length,
    }
  })

  const clientBalances = new Map<
    string,
    { name: string; cuit: string; debit: number; credit: number; movements: number }
  >()

  for (const movement of accountMovements) {
    const current =
      clientBalances.get(movement.client_id) ||
      {
        name: movement.client?.name || 'Cliente sin nombre',
        cuit: movement.client?.cuit || '',
        debit: 0,
        credit: 0,
        movements: 0,
      }
    current.debit += toNumber(movement.debit)
    current.credit += toNumber(movement.credit)
    current.movements += 1
    clientBalances.set(movement.client_id, current)
  }

  const workbook = XLSX.utils.book_new()
  workbook.Props = {
    Title: 'Reporte de Tesoreria',
    Subject: `Tesoreria ${year}`,
    Author: 'ZOMA ERP',
    CreatedDate: new Date(),
  }

  appendSheet(
    workbook,
    'Resumen',
    [
      ['Reporte de Tesoreria'],
      ['Empresa', context.nombreEmpresa || companyId],
      ['Periodo', `${from} a ${to}`],
      [],
      ['Indicador', 'Monto / Cantidad'],
      ['Ingresos totales', totalIngresos],
      ['Egresos totales', totalEgresos],
      ['Balance neto', totalIngresos - totalEgresos],
      ['Compras a proveedores', totalComprasProveedor],
      ['Pagos a proveedores', totalPagosProveedor],
      ['Saldo proveedores', totalComprasProveedor - totalPagosProveedor],
      ['Cuentas por cobrar', cuentasPorCobrar],
      ['Cantidad movimientos caja', ledger.length],
      ['Cantidad proveedores', suppliers.length],
      ['Cantidad compras registradas', purchases.length],
    ],
    [28, 24]
  )

  appendSheet(
    workbook,
    'Resumen mensual',
    [
      ['Mes', 'Ingresos', 'Egresos', 'Balance neto', 'Cantidad ingresos', 'Cantidad egresos'],
      ...monthly.map((row) => [
        row.month,
        row.ingresos,
        row.egresos,
        row.ingresos - row.egresos,
        row.cantidadIngresos,
        row.cantidadEgresos,
      ]),
      [
        'Total',
        totalIngresos,
        totalEgresos,
        totalIngresos - totalEgresos,
        monthly.reduce((sum, row) => sum + row.cantidadIngresos, 0),
        monthly.reduce((sum, row) => sum + row.cantidadEgresos, 0),
      ],
    ],
    [16, 16, 16, 16, 18, 18]
  )

  appendSheet(
    workbook,
    'Movimientos caja',
    [
      ['Fecha', 'Tipo', 'Concepto', 'Monto', 'Metodo de pago', 'Origen', 'ID origen', 'Fecha carga'],
      ...ledger.map((entry) => [
        formatDate(entry.entry_date),
        entry.entry_type === 'ingreso' ? 'Ingreso' : 'Egreso',
        entry.concept || '',
        toNumber(entry.amount),
        entry.payment_method || '',
        entry.source_table || '',
        entry.source_id || '',
        formatDate(entry.created_at),
      ]),
    ],
    [14, 12, 42, 16, 18, 24, 38, 14]
  )

  appendSheet(
    workbook,
    'Proveedores',
    [
      ['Proveedor', 'CUIT', 'Telefono', 'Email', 'Direccion', 'Activo', 'Total compras', 'Total pagos', 'Saldo', 'Movimientos'],
      ...supplierTotals.map(({ supplier, compras, pagos, saldo, movimientos }) => [
        supplier.name,
        supplier.cuit || '',
        supplier.phone || '',
        supplier.email || '',
        supplier.address || '',
        supplier.active === false ? 'No' : 'Si',
        compras,
        pagos,
        saldo,
        movimientos,
      ]),
    ],
    [30, 16, 18, 28, 34, 10, 16, 16, 16, 14]
  )

  appendSheet(
    workbook,
    'Cta cte proveedores',
    [
      ['Fecha', 'Proveedor', 'Tipo', 'Descripcion', 'Compra / Haber', 'Pago / Debe', 'Metodo de pago', 'Fecha carga', 'ID'],
      ...supplierMovements.map((movement) => [
        formatDate(movement.movement_date),
        supplierById.get(movement.supplier_id)?.name || 'Proveedor no encontrado',
        movement.movement_type,
        movement.description || '',
        toNumber(movement.credit),
        toNumber(movement.debit),
        movement.payment_method || '',
        formatDate(movement.created_at),
        movement.id,
      ]),
    ],
    [14, 30, 12, 42, 16, 16, 18, 14, 38]
  )

  appendSheet(
    workbook,
    'Cuentas por cobrar',
    [
      ['Cliente', 'CUIT', 'Debitos / Ventas', 'Creditos / Cobros', 'Saldo', 'Movimientos'],
      ...Array.from(clientBalances.values()).map((client) => [
        client.name,
        client.cuit,
        client.debit,
        client.credit,
        client.debit - client.credit,
        client.movements,
      ]),
    ],
    [32, 16, 18, 18, 18, 14]
  )

  appendSheet(
    workbook,
    'Compras',
    [
      [
        'Fecha',
        'Producto',
        'Codigo',
        'Proveedor',
        'Cantidad',
        'Costo unitario',
        'Subtotal',
        'Impuestos',
        'Total',
        'Estado pago',
        'Pagado',
        'Metodo',
        'Factura',
        'Remito',
        'Notas',
      ],
      ...purchases.map((purchase) => {
        const total = toNumber(purchase.total_with_tax) || toNumber(purchase.total_cost)
        return [
          formatDate(purchase.purchase_date),
          purchase.product_name,
          purchase.product_code || '',
          supplierById.get(purchase.supplier_id || '')?.name || purchase.supplier || '',
          toNumber(purchase.quantity),
          toNumber(purchase.unit_cost),
          toNumber(purchase.total_cost),
          toNumber(purchase.tax_amount),
          total,
          purchase.payment_status || '',
          toNumber(purchase.amount_paid),
          purchase.payment_method || '',
          purchase.provider_invoice || '',
          purchase.provider_remito || '',
          purchase.notes || '',
        ]
      }),
    ],
    [14, 34, 16, 30, 12, 16, 16, 16, 16, 14, 16, 18, 18, 18, 42]
  )

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const body = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer
  const filename = buildFilename(context.nombreEmpresa, year)

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

