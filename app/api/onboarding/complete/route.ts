import { NextResponse } from 'next/server'
import { CompanyAccessError, requireActiveCompany } from '@/lib/billing/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const context = await requireActiveCompany()
    const admin = createSupabaseAdminClient()
    const { error } = await admin
      .from('companies')
      .update({
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', context.companyId)

    if (error) {
      return NextResponse.json({ error: 'No pudimos finalizar el onboarding.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: 'No pudimos finalizar el onboarding.' }, { status: 500 })
  }
}
