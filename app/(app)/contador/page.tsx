import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getArcaCredentialsMetadata } from '@/lib/arca/credentialsService'
import ContadorClient from './ContadorClient'

export default async function AccountantPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')

  const supabase = await createServerComponentClient()
  const supabaseAdmin = createSupabaseAdminClient()

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

  // 2. Obtener metadatos fiscales seguros (sin secretos ni payloads)
  const [homoMeta, prodMeta] = await Promise.all([
    getArcaCredentialsMetadata(supabaseAdmin, contexto.idEmpresa, 'homo'),
    getArcaCredentialsMetadata(supabaseAdmin, contexto.idEmpresa, 'prod')
  ])

  const configFiscalMeta = prodMeta.configured ? prodMeta : homoMeta

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

  // 5. Obtener los contadores vinculados a la empresa
  const { data: contadores } = await supabase
    .from('users_profiles')
    .select('id, full_name, created_at')
    .eq('company_id', contexto.idEmpresa)
    .eq('role', 'contador')

  return (
    <ContadorClient 
      invoicesIniciales={invoices || []} 
      idEmpresa={contexto.idEmpresa}
      nombreEmpresa={contexto.nombreEmpresa}
      configFiscal={configFiscalMeta}
      clients={clients || []}
      movements={movements || []}
      userRole={contexto.rol}
      contadoresIniciales={contadores || []}
    />
  )
}
