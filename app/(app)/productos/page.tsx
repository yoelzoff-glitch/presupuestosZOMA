import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import ProductosClient from './ProductosClient'

export default async function ProductosPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')
  if (contexto.rol !== 'admin') redirect('/')

  const supabase = await createServerComponentClient()

  const { data } = await supabase
    .from('products')
    .select('id, internal_code, name, supplier, category, cost_price, last_price_update')
    .eq('company_id', contexto.idEmpresa)
    .order('name', { ascending: true })
    .range(0, 4999)

  return (
    <ProductosClient
      productosIniciales={data || []}
      idEmpresa={contexto.idEmpresa}
    />
  )
}