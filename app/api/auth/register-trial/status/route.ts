import { NextResponse } from 'next/server'
import {
  createServerComponentClient,
  createSupabaseAdminClient,
} from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createServerComponentClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const { data: session, error } = await admin
    .from('onboarding_sessions')
    .select(`
      id,
      status,
      company_id,
      mp_status,
      mp_init_point,
      trial_ends_at,
      last_error_code,
      last_error_message,
      updated_at
    `)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'No pudimos consultar el onboarding.' }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: 'No hay un onboarding iniciado.' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    onboarding_session_id: session.id,
    status: session.status,
    mp_status: session.mp_status,
    checkout_url: session.mp_init_point,
    company_id: session.company_id,
    trial_ends_at: session.trial_ends_at,
    error:
      session.status === 'provisioning_failed'
        ? 'No pudimos terminar de crear la empresa. El equipo puede reintentar el proceso sin volver a cobrar.'
        : null,
    redirect_to: session.company_id ? '/onboarding' : null,
  })
}
