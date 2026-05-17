import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import InventarioClient from './InventarioClient'
import { redirect } from 'next/navigation'

export default async function InventarioPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('company_id, company:companies(plan_type, enable_stock_module)')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/auth/login')

  const planType = (profile.company as any)?.plan_type || 'base'
  const enableStockModule = (profile.company as any)?.enable_stock_module || false

  // Load products (only if planType !== 'base' && enableStockModule)
  let products: any[] = []
  if (planType !== 'base' && enableStockModule) {
    const { data } = await supabase
      .from('products')
      .select('id, name, internal_code, stock_quantity, min_stock_level, track_stock, category, is_bundle')
      .eq('company_id', profile.company_id)
      .eq('active', true)
      .order('name')
    products = data || []
  }

  return (
    <InventarioClient 
      initialProducts={products} 
      companyId={profile.company_id} 
      planType={planType}
      enableStockModule={enableStockModule}
    />
  )
}
