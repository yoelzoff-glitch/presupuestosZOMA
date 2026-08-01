import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getBillingPlan, getPublicAppUrl } from '@/lib/billing/config'
import { createTrialPreapproval } from '@/lib/billing/mercadopago'
import {
  createServerComponentClient,
  createSupabaseAdminClient,
} from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const registerTrialSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  company_name: z.string().trim().min(2).max(160),
  company_cuit: z.string().trim().max(20).optional().default(''),
  company_phone: z.string().trim().max(40).optional().default(''),
  business_type: z.enum(['products', 'services']),
  plan_type: z.enum(['base', 'pro']),
  idempotency_key: z.string().uuid(),
})

function requestFingerprint(request: NextRequest, email: string) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || request.headers.get('x-real-ip') || 'unknown'
  const salt = process.env.BILLING_RATE_LIMIT_SALT || 'zoma-onboarding'
  return crypto
    .createHash('sha256')
    .update(`${salt}:${ip}:${email.toLowerCase()}`)
    .digest('hex')
}

export async function POST(request: NextRequest) {
  const supabase = await createServerComponentClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json(
      { error: 'Debes iniciar sesiÃ³n antes de autorizar la suscripciÃ³n.' },
      { status: 401 }
    )
  }

  const parsed = registerTrialSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Revisa los datos ingresados.', fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const admin = createSupabaseAdminClient()
  const input = parsed.data

  const { data: existingProfile } = await admin
    .from('users_profiles')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle()

  if (existingProfile?.company_id) {
    return NextResponse.json(
      { error: 'Tu usuario ya pertenece a una empresa.' },
      { status: 409 }
    )
  }

  const fingerprint = requestFingerprint(request, user.email)
  const { data: allowed, error: rateLimitError } = await admin.rpc(
    'consume_saas_rate_limit',
    {
      p_rate_key: `register:${fingerprint}`,
      p_max_hits: 8,
      p_window_seconds: 3600,
    }
  )

  if (rateLimitError) {
    console.error('Onboarding rate limit unavailable:', rateLimitError.message)
    return NextResponse.json(
      { error: 'La base de datos de onboarding todavÃ­a no estÃ¡ disponible.' },
      { status: 503 }
    )
  }

  if (!allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera unos minutos antes de continuar.' },
      { status: 429 }
    )
  }

  const { data: existingSession } = await admin
    .from('onboarding_sessions')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (existingSession?.company_id) {
    return NextResponse.json({
      ok: true,
      status: 'provisioned',
      company_id: existingSession.company_id,
      redirect_to: '/onboarding',
    })
  }

  if (existingSession?.mp_init_point && existingSession.mp_status !== 'cancelled') {
    return NextResponse.json({
      ok: true,
      status: existingSession.status,
      checkout_url: existingSession.mp_init_point,
      onboarding_session_id: existingSession.id,
    })
  }

  const plan = getBillingPlan(input.plan_type)
  let session = existingSession

  if (!session) {
    const { data, error } = await admin
      .from('onboarding_sessions')
      .insert({
        auth_user_id: user.id,
        email: user.email.toLowerCase(),
        full_name: input.full_name,
        company_name: input.company_name,
        company_cuit: input.company_cuit || null,
        company_phone: input.company_phone || null,
        business_type: input.business_type,
        plan_type: input.plan_type,
        idempotency_key: input.idempotency_key,
        status: 'pending_checkout',
        plan_amount: plan.amount,
        currency_id: plan.currency,
        request_ip_hash: fingerprint,
        request_user_agent: request.headers.get('user-agent'),
      })
      .select('*')
      .single()

    if (error || !data) {
      const { data: concurrentSession } = await admin
        .from('onboarding_sessions')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (!concurrentSession) {
        console.error('Could not create onboarding session:', error?.message)
        return NextResponse.json(
          { error: 'No pudimos iniciar el onboarding.' },
          { status: 500 }
        )
      }
      session = concurrentSession
    } else {
      session = data
    }
  }

  const appUrl = getPublicAppUrl(request.url)
  const externalReference = `zoma_onboarding:${session.id}`

  try {
    const preapproval = await createTrialPreapproval({
      email: user.email,
      externalReference,
      backUrl: `${appUrl}/register/return?session=${session.id}`,
      notificationUrl: `${appUrl}/api/webhooks/mercadopago?source_news=webhooks`,
      plan,
      idempotencyKey: `zoma-${session.id}`,
    })

    if (!preapproval.id || !preapproval.init_point) {
      throw new Error('Mercado Pago did not return a checkout URL')
    }

    const trialStartedAt = new Date()
    const fallbackTrialEnd = new Date(trialStartedAt)
    fallbackTrialEnd.setUTCDate(fallbackTrialEnd.getUTCDate() + 14)
    const trialEndsAt = preapproval.next_payment_date
      ? new Date(preapproval.next_payment_date)
      : fallbackTrialEnd

    const normalizedStatus =
      preapproval.status === 'authorized' ? 'authorized' : 'pending_authorization'

    const { error: updateError } = await admin
      .from('onboarding_sessions')
      .update({
        status: normalizedStatus,
        mp_preapproval_id: preapproval.id,
        mp_payer_id: preapproval.payer_id ? String(preapproval.payer_id) : null,
        mp_external_reference: externalReference,
        mp_init_point: preapproval.init_point,
        mp_status: preapproval.status,
        trial_started_at: trialStartedAt.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        next_payment_at: preapproval.next_payment_date || trialEndsAt.toISOString(),
        last_error_code: null,
        last_error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    if (updateError) throw updateError

    if (preapproval.status === 'authorized') {
      const { data: provisionResult, error: provisionError } = await admin.rpc(
        'provision_trial_tenant',
        {
          p_onboarding_session_id: session.id,
          p_auth_user_id: user.id,
        },
      )
      if (provisionError) throw provisionError

      const result = provisionResult as { status?: string } | null
      if (result?.status === 'provisioning_failed') {
        return NextResponse.json(
          {
            ok: false,
            status: 'provisioning_failed',
            checkout_url: preapproval.init_point,
            onboarding_session_id: session.id,
            error:
              'Mercado Pago autorizo la suscripcion, pero no pudimos crear la empresa. El equipo puede reintentar el aprovisionamiento sin volver a cobrar.',
          },
          { status: 202 },
        )
      }
    }

    return NextResponse.json({
      ok: true,
      status: normalizedStatus,
      checkout_url: preapproval.init_point,
      onboarding_session_id: session.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown onboarding error'
    await admin
      .from('onboarding_sessions')
      .update({
        status: 'pending_checkout',
        last_error_code: 'preapproval_failed',
        last_error_message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    console.error('Could not create Mercado Pago preapproval:', message)
    return NextResponse.json(
      { error: 'No pudimos iniciar el checkout de Mercado Pago. Intenta nuevamente.' },
      { status: 502 }
    )
  }
}
