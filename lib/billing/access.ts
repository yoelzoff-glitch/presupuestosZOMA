import { createServerComponentClient } from '@/lib/supabase/server'

export type CompanyBillingState = {
  id: string
  billing_status: string | null
  trial_ends_at: string | null
  billing_grace_ends_at: string | null
  billing_cancel_at_period_end: boolean | null
  billing_next_charge_at: string | null
  subscription_expiry: string | null
  mp_preapproval_id: string | null
  mp_init_point: string | null
  onboarding_completed_at: string | null
}

export type ActiveCompanyContext = {
  userId: string
  companyId: string
  role: string
  company: CompanyBillingState
}

export class CompanyAccessError extends Error {
  constructor(
    public code: 'unauthenticated' | 'missing_company' | 'billing_blocked',
    public status: number
  ) {
    super(code)
  }
}

export function hasBillingAccess(company: CompanyBillingState, now = new Date()) {
  const status = company.billing_status

  if (!status) {
    if (!company.subscription_expiry) return true
    return new Date(company.subscription_expiry).getTime() >= now.getTime()
  }

  if (status === 'active') return true

  if (status === 'trial') {
    const trialEnd = company.trial_ends_at || company.subscription_expiry
    return Boolean(trialEnd && new Date(trialEnd).getTime() >= now.getTime())
  }

  if (status === 'past_due' && company.billing_grace_ends_at) {
    return new Date(company.billing_grace_ends_at).getTime() >= now.getTime()
  }

  return false
}

export async function getCompanyContext(): Promise<ActiveCompanyContext | null> {
  const supabase = await createServerComponentClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('users_profiles')
    .select(`
      company_id,
      role,
      company:companies (
        id,
        billing_status,
        trial_ends_at,
        billing_grace_ends_at,
        billing_cancel_at_period_end,
        billing_next_charge_at,
        subscription_expiry,
        mp_preapproval_id,
        mp_init_point,
        onboarding_completed_at
      )
    `)
    .eq('id', user.id)
    .maybeSingle()

  const company = Array.isArray(profile?.company)
    ? profile.company[0]
    : profile?.company

  if (!profile?.company_id || !company) return null

  return {
    userId: user.id,
    companyId: profile.company_id,
    role: profile.role || 'admin',
    company: company as CompanyBillingState,
  }
}

export async function requireActiveCompany() {
  const supabase = await createServerComponentClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new CompanyAccessError('unauthenticated', 401)

  const context = await getCompanyContext()
  if (!context) throw new CompanyAccessError('missing_company', 409)
  if (!hasBillingAccess(context.company)) {
    throw new CompanyAccessError('billing_blocked', 402)
  }

  return context
}
