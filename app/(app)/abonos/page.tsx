import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import AbonosClient from './AbonosClient'

export default async function AbonosPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')
  if (contexto.rol !== 'admin') redirect('/')

  const supabase = await createServerComponentClient()

  // Validar que la empresa sea de servicios
  const { data: companyData } = await supabase
    .from('companies')
    .select('business_type, name, cuit')
    .eq('id', contexto.idEmpresa)
    .single()

  if (companyData?.business_type !== 'services') {
    redirect('/')
  }

  // Cargar abonos activos
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select(`
      id,
      company_id,
      client_id,
      budget_id,
      name,
      items,
      total_amount,
      status,
      last_billed_month,
      created_at,
      clients (
        id,
        name,
        email,
        phone,
        cuit
      )
    `)
    .eq('company_id', contexto.idEmpresa)
    .order('created_at', { ascending: false })

  // Cargar todos los clientes activos para selección o creación de abonos directos
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, phone, cuit')
    .eq('company_id', contexto.idEmpresa)
    .eq('active', true)
    .order('name', { ascending: true })

  // Normalizar los abonos para manejar el alias de clients correctamente
  const normalizedSubscriptions = (subscriptions || []).map(sub => ({
    ...sub,
    clients: Array.isArray(sub.clients) ? sub.clients[0] : sub.clients
  }))

  return (
    <AbonosClient
      abonosIniciales={normalizedSubscriptions}
      clientes={clients || []}
      idEmpresa={contexto.idEmpresa}
      empresaNombre={companyData?.name || ''}
    />
  )
}
