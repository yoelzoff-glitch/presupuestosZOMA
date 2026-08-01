import { redirect } from 'next/navigation'
import OnboardingWizard from '@/app/components/OnboardingWizard'
import { getCompanyContext, hasBillingAccess } from '@/lib/billing/access'

export default async function OnboardingPage() {
  const context = await getCompanyContext()
  if (!context) redirect('/register')
  if (!hasBillingAccess(context.company)) redirect('/vencido')
  if (context.company.onboarding_completed_at) redirect('/dashboard')
  return <OnboardingWizard />
}
