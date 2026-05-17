import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import PedidosClient from './PedidosClient'

export default async function PedidosPage() {
  const context = await getServerUserContext()
  if (!context) redirect('/auth/login')

  const supabase = await createServerComponentClient()

  const [ordersRes, sellersRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`id, order_number, order_code, order_date, status, source, total_amount, seller_id, budget_id, clients ( name, cuit ), budget:budgets ( afip_cae, invoices ( id ) )`)
      .eq('company_id', context.idEmpresa)
      .order('created_at', { ascending: false }),
    supabase
      .from('users_profiles')
      .select('id, full_name')
      .eq('company_id', context.idEmpresa)
      .order('full_name'),
  ])

  const orders = (ordersRes.data || []).map((item: any) => ({
    ...item,
    clients: Array.isArray(item.clients) ? item.clients[0] || null : item.clients || null,
    budget: Array.isArray(item.budget) ? item.budget[0] || null : item.budget || null
  }))

  return (
    <PedidosClient
      initialOrders={orders}
      initialSellers={sellersRes.data || []}
      companyId={context.idEmpresa}
      planType={context.tipoPlan}
    />
  )
}
