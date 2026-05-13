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
    .select('company_id, company:companies(plan_type)')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/auth/login')

  const planType = (profile.company as any)?.plan_type || 'base'
  if (planType === 'base') {
    redirect('/configuracion/plan?error=plan_restriction')
  }

  // Load products that have track_stock enabled or are relevant for inventory
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', profile.company_id)
    .eq('active', true)
    .order('name')

  return (
    <InventarioClient 
      initialProducts={products || []} 
      companyId={profile.company_id} 
    />
  )
}
