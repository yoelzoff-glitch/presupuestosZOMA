import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { processBillingResource } from '@/lib/billing/processWebhookEvent'
import { verifyMercadoPagoWebhookSignature } from '@/lib/mercadopago/verifyWebhookSignature'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type WebhookPayload = {
  id?: string | number
  type?: string
  action?: string
  live_mode?: boolean
  data?: { id?: string | number }
}

export async function POST(request: NextRequest) {
  const secret =
    process.env.MERCADOPAGO_BILLING_WEBHOOK_SECRET?.trim() ||
    process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()

  if (!verifyMercadoPagoWebhookSignature(request, { secret })) {
    return NextResponse.json({ received: false, error: 'invalid_signature' }, { status: 401 })
  }

  const payload = (await request.json().catch(() => null)) as WebhookPayload | null
  const url = new URL(request.url)
  const resourceId = String(
    payload?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || ''
  )
  const eventType = payload?.type || url.searchParams.get('type') || ''

  if (!resourceId || !eventType) {
    return NextResponse.json({ received: false, error: 'invalid_payload' }, { status: 400 })
  }

  const eventKey = crypto
    .createHash('sha256')
    .update([
      payload?.live_mode ? 'live' : 'test',
      eventType,
      payload?.action || '',
      String(payload?.id || ''),
      resourceId,
    ].join(':'))
    .digest('hex')

  const admin = createSupabaseAdminClient()
  const { error: insertError } = await admin.from('saas_webhook_events').insert({
    event_key: eventKey,
    mp_event_id: payload?.id ? String(payload.id) : null,
    event_type: eventType,
    event_action: payload?.action || null,
    resource_id: resourceId,
    request_id: request.headers.get('x-request-id'),
    live_mode: payload?.live_mode ?? null,
    signature_valid: true,
    payload: payload || {},
    processing_status: 'received',
  })

  if (insertError?.code === '23505') {
    return NextResponse.json({ received: true, duplicate: true })
  }
  if (insertError) {
    console.error('Could not persist billing webhook:', insertError.message)
    return NextResponse.json({ received: false }, { status: 500 })
  }

  await admin
    .from('saas_webhook_events')
    .update({ processing_status: 'processing', processing_attempts: 1 })
    .eq('event_key', eventKey)

  try {
    const result = await processBillingResource({
      type: eventType,
      resourceId,
      eventKey,
      payload: (payload || {}) as Record<string, unknown>,
    })

    await admin
      .from('saas_webhook_events')
      .update({
        processing_status: result.ignored ? 'ignored' : 'processed',
        processed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('event_key', eventKey)

    return NextResponse.json({ received: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error'
    await admin
      .from('saas_webhook_events')
      .update({ processing_status: 'failed', last_error: message.slice(0, 1000) })
      .eq('event_key', eventKey)
    console.error('SaaS billing webhook failed:', message)
    return NextResponse.json({ received: false }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } })
}
