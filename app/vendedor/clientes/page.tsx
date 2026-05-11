import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import ClientesVendedorClient from './ClientesVendedorClient'

export default async function VendedorClientesPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')

  const supabase = await createServerComponentClient()

  const esAdmin = contexto.rol === 'admin'

  let consulta = supabase
    .from('clients')
    .select('id, name, cuit, email, phone, address, created_at')
    .order('name', { ascending: true })

  if (!esAdmin) {
    consulta = consulta.eq('seller_id', contexto.idUsuario)
  }

  const { data } = await consulta

  return (
    <ClientesVendedorClient 
      clientesIniciales={data || []} 
      rol={contexto.rol} 
      idUsuario={contexto.idUsuario} 
    />
  )
}
