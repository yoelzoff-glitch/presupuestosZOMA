import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import ClientesClient from './ClientesClient'

export default async function ClientesPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')

  const supabase = await createServerComponentClient()

  const [resClientes, resVendedores] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('company_id', contexto.idEmpresa)
      .order('name', { ascending: true }),
    supabase
      .from('users_profiles')
      .select('id, full_name')
      .eq('company_id', contexto.idEmpresa)
      .eq('role', 'vendedor')
      .order('full_name'),
  ])

  return (
    <ClientesClient
      clientesIniciales={resClientes.data || []}
      vendedoresIniciales={resVendedores.data || []}
      idEmpresa={contexto.idEmpresa}
      tipoPlan={contexto.tipoPlan}
    />
  )
}