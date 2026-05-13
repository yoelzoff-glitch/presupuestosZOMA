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
    .select('id, internal_code, name, supplier, category, cost_price, sale_price, last_price_update, stock_quantity, track_stock, show_in_catalog')
    .eq('company_id', contexto.idEmpresa)
    .eq('active', true)
    .order('name', { ascending: true })
    .range(0, 4999)

  const { data: companyData } = await supabase
    .from('companies')
    .select('enable_stock_module')
    .eq('id', contexto.idEmpresa)
    .single()

  return (
    <ProductosClient
      productosIniciales={data || []}
      idEmpresa={contexto.idEmpresa}
      enableStockModule={companyData?.enable_stock_module || false}
    />
  )
}