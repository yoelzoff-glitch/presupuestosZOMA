import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import PedidosVendedorClient from './PedidosVendedorClient'

export default async function VendedorPedidosPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')

  const supabase = await createServerComponentClient()

  const esAdmin = contexto.rol === 'admin'

  let consulta = supabase
    .from('orders')
    .select(`
      id, order_number, order_code, order_date, total_amount, status, created_at,
      clients ( name, cuit )
    `)
    .order('order_number', { ascending: false })

  if (!esAdmin) {
    consulta = consulta.eq('seller_id', contexto.idUsuario)
  }

  const { data } = await consulta

  const normalizados = (data || []).map((p: any) => ({
    ...p,
    client: Array.isArray(p.clients) ? p.clients[0] || null : p.clients || null,
  }))

  return (
    <PedidosVendedorClient 
      pedidosIniciales={normalizados} 
      rol={contexto.rol} 
      idUsuario={contexto.idUsuario} 
    />
  )
}
