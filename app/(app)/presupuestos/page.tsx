import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import PresupuestosClient from './PresupuestosClient'

export default async function PresupuestosPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')

  const supabase = await createServerComponentClient()

  // Obtener presupuestos de los últimos 30 días y vendedores en paralelo — en el servidor
  const limiteFecha = new Date()
  limiteFecha.setDate(limiteFecha.getDate() - 30)

  const [resPresupuestos, resVendedores] = await Promise.all([
    supabase
      .from('budgets')
      .select(`id, budget_number, budget_code, budget_date, total_amount, status, payment_status, paid_amount, created_at, seller_id, afip_cae, clients ( name, cuit ), seller:users_profiles!budgets_seller_id_fkey ( full_name )`)
      .eq('company_id', contexto.idEmpresa)
      .gte('created_at', limiteFecha.toISOString())
      .order('budget_number', { ascending: false }),
    supabase
      .from('users_profiles')
      .select('id, full_name')
      .eq('company_id', contexto.idEmpresa)
      .order('full_name'),
  ])

  // Normalizar datos de relaciones
  const presupuestos = (resPresupuestos.data || []).map((p: any) => ({
    ...p,
    client: Array.isArray(p.clients) ? p.clients[0] || null : p.clients || null,
    seller: Array.isArray(p.seller) ? p.seller[0] || null : p.seller || null,
  }))

  return (
    <PresupuestosClient
      presupuestosIniciales={presupuestos}
      vendedoresIniciales={resVendedores.data || []}
      idEmpresa={contexto.idEmpresa}
      planType={contexto.tipoPlan}
    />
  )
}
