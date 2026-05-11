import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import CuentaCorrienteClient from './CuentaCorrienteClient'

export default async function CuentaCorrientePage() {
  const context = await getServerUserContext()
  if (!context) redirect('/auth/login')

  const supabase = await createServerComponentClient()

  // Fetch clients and company payment methods in parallel on the server
  const [clientsRes, companyRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, cuit')
      .eq('company_id', context.companyId)
      .eq('active', true)
      .order('name', { ascending: true }),
    supabase
      .from('companies')
      .select('payment_methods')
      .eq('id', context.companyId)
      .single(),
  ])

  const paymentMethods = (companyRes.data?.payment_methods as any[])?.map((m: any) => m.name) || []

  return (
    <CuentaCorrienteClient
      initialClients={clientsRes.data || []}
      companyId={context.companyId}
      initialPaymentMethods={paymentMethods}
    />
  )
}
