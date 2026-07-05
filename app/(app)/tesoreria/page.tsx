import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import TesoreriaClient from './TesoreriaClient'

export default async function TesoreriaPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')
  if (contexto.rol !== 'admin') redirect('/')

  const supabase = await createServerComponentClient()

  // Cargar toda la data necesaria en paralelo
  const [
    treasuryRes,
    ledgerRes,
    productosRes,
    comprasRes,
    proveedoresRes,
    pagosProveedoresRes,
    clientBalancesRes,
    companyRes,
  ] = await Promise.all([
    // KPIs del dashboard
    supabase
      .from('v_treasury_summary')
      .select('*')
      .eq('company_id', contexto.idEmpresa)
      .single(),
    // Entradas del Libro Diario (últimas 1000)
    supabase
      .from('v_ledger_entries')
      .select('*')
      .eq('company_id', contexto.idEmpresa)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000),
    // Productos activos (para el simulador de compras)
    supabase
      .from('products')
      .select('id, internal_code, name, supplier, category, cost_price, sale_price, last_price_update')
      .eq('company_id', contexto.idEmpresa)
      .eq('active', true)
      .order('name', { ascending: true })
      .range(0, 4999),
    // Compras históricas
    supabase
      .from('purchases')
      .select('*')
      .eq('company_id', contexto.idEmpresa)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, 999),
    // Proveedores normalizados
    supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', contexto.idEmpresa)
      .order('name', { ascending: true }),
    // Pagos a proveedores
    supabase
      .from('supplier_payments')
      .select('*')
      .eq('company_id', contexto.idEmpresa)
      .order('payment_date', { ascending: false }),
    // Saldos de clientes (cuentas por cobrar)
    supabase
      .from('v_client_balances')
      .select('*')
      .eq('company_id', contexto.idEmpresa),
    // Métodos de pago de la empresa
    supabase
      .from('companies')
      .select('payment_methods')
      .eq('id', contexto.idEmpresa)
      .single(),
  ])

  const paymentMethods = (companyRes.data?.payment_methods as any[])?.map((m: any) => m.name) || []

  return (
    <TesoreriaClient
      idEmpresa={contexto.idEmpresa}
      treasurySummary={treasuryRes.data || null}
      ledgerEntries={ledgerRes.data || []}
      productosIniciales={productosRes.data || []}
      comprasIniciales={comprasRes.data || []}
      proveedoresIniciales={proveedoresRes.data || []}
      pagosProveedoresIniciales={pagosProveedoresRes.data || []}
      clientBalancesIniciales={clientBalancesRes.data || []}
      paymentMethods={paymentMethods}
    />
  )
}
