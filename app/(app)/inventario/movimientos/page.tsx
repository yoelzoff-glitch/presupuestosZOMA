import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import MovimientosClient from './MovimientosClient'
import { redirect } from 'next/navigation'

export default async function MovimientosPage() {
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

  // Load last 100 movements
  const { data: movements } = await supabase
    .from('stock_movements')
    .select(`
      *,
      products (
        name,
        internal_code
      )
    `)
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <MovimientosClient 
      initialMovements={movements || []} 
    />
  )
}
