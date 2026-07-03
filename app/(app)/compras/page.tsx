import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import ComprasClient from './ComprasClient'

export default async function ComprasPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')
  if (contexto.rol !== 'admin') redirect('/')

  const supabase = await createServerComponentClient()

  // 1. Cargar productos activos
  const { data: productos } = await supabase
    .from('products')
    .select('id, internal_code, name, supplier, category, cost_price, sale_price, last_price_update')
    .eq('company_id', contexto.idEmpresa)
    .eq('active', true)
    .order('name', { ascending: true })
    .range(0, 4999)

  // 2. Cargar compras históricas
  const { data: compras } = await supabase
    .from('purchases')
    .select('*')
    .eq('company_id', contexto.idEmpresa)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(0, 999)

  return (
    <ComprasClient
      productosIniciales={productos || []}
      comprasIniciales={compras || []}
      idEmpresa={contexto.idEmpresa}
    />
  )
}
