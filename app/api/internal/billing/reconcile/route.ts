import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { reconcilePreapproval } from '@/lib/billing/processWebhookEvent'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: NextRequest) {
  const expected = process.env.BILLING_RECONCILIATION_SECRET?.trim()
  const received = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || !received) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(received)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const { data: sessions, error } = await admin
    .from('onboarding_sessions')
    .select('id, mp_preapproval_id, updated_at')
    .not('mp_preapproval_id', 'is', null)
    .in('status', ['pending_authorization', 'authorized', 'provisioning_failed'])
    .order('updated_at', { ascending: true })
    .limit(40)

  if (error) {
    return NextResponse.json({ error: 'No pudimos leer los pendientes.' }, { status: 500 })
  }

  const results = []
  for (const session of sessions || []) {
    const bucket = Math.floor(Date.now() / (15 * 60 * 1000))
    const eventKey = `reconcile:${session.mp_preapproval_id}:${bucket}`
    try {
      const result = await reconcilePreapproval(session.mp_preapproval_id, eventKey)
      results.push({ id: session.id, ok: true, result })
    } catch (reconcileError) {
      results.push({
        id: session.id,
        ok: false,
        error: reconcileError instanceof Error ? reconcileError.message : 'unknown',
      })
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results })
}
