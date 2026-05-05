import { supabase } from '@/lib/supabase/client'

export async function getUserCompanyId(): Promise<string | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return null

  const { data, error } = await supabase
    .from('users_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (error) return null

  return data?.company_id || null
}