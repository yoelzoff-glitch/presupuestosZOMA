import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import PresupuestosVendedorClient from './PresupuestosVendedorClient'

export default async function VendedorPresupuestosPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')

  const supabase = await createServerComponentClient()

  const esAdmin = contexto.rol === 'admin'

  let consulta = supabase
    .from('budgets')
    .select(`
      id, budget_number, budget_code, budget_date, total_amount, status, created_at,
      clients ( name, cuit )
    `)
    .order('budget_number', { ascending: false })

  if (!esAdmin) {
    consulta = consulta.eq('seller_id', contexto.idUsuario)
  }

  const { data } = await consulta

  const normalizados = (data || []).map((p: any) => ({
    ...p,
    client: Array.isArray(p.clients) ? p.clients[0] || null : p.clients || null,
  }))

  return (
    <PresupuestosVendedorClient 
      presupuestosIniciales={normalizados} 
      rol={contexto.rol} 
      idUsuario={contexto.idUsuario} 
    />
  )
}
