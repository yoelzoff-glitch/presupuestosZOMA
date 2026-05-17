import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import ContadorClient from './ContadorClient'

export default async function AccountantPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')

  const supabase = await createServerComponentClient()

  // 1. Obtener facturas legalizadas
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients ( name, cuit )
    `)
    .eq('company_id', contexto.idEmpresa)
    .neq('status', 'draft') // Omitir borradores
    .order('invoice_date', { ascending: false })

  if (invoicesError) console.error('Error cargando facturas para contador:', invoicesError)

  // 2. Obtener configuración fiscal de la empresa
  const { data: config } = await supabase
    .from('afip_configs')
    .select('*')
    .eq('company_id', contexto.idEmpresa)
    .single()

  // 3. Obtener clientes para la Cuenta Corriente
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, cuit')
    .eq('company_id', contexto.idEmpresa)
    .eq('active', true)
    .order('name', { ascending: true })

  // 4. Obtener todos los movimientos de cuentas corrientes para calcular saldos
  const { data: movements } = await supabase
    .from('account_movements')
    .select('client_id, debit, credit')
    .eq('company_id', contexto.idEmpresa)

  return (
    <ContadorClient 
      invoicesIniciales={invoices || []} 
      idEmpresa={contexto.idEmpresa}
      nombreEmpresa={contexto.nombreEmpresa}
      configFiscal={config || null}
      clients={clients || []}
      movements={movements || []}
      userRole={contexto.rol} // Pasamos el rol real del usuario para habilitar/deshabilitar invitaciones
    />
  )
}
