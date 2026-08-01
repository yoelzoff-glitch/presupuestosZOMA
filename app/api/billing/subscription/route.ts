import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCompanyContext } from '@/lib/billing/access'
import { cancelPreapproval } from '@/lib/billing/mercadopago'
import { reconcilePreapproval } from '@/lib/billing/processWebhookEvent'

export const dynamic = 'force-dynamic'

export async function GET() {
  const context = await getCompanyContext()
  if (!context) {
    return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 })
  }

  return NextResponse.json({
    status: context.company.billing_status,
    trial_ends_at: context.company.trial_ends_at,
    next_charge_at: context.company.billing_next_charge_at,
    cancel_at_period_end: context.company.billing_cancel_at_period_end,
    checkout_url: context.company.mp_init_point,
  })
}

const actionSchema = z.object({ action: z.enum(['cancel']) })

export async function POST(request: NextRequest) {
  const context = await getCompanyContext()
  if (!context) {
    return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 })
  }
  if (context.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un administrador puede cancelar.' }, { status: 403 })
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
  }
  if (!context.company.mp_preapproval_id) {
    return NextResponse.json({ error: 'La empresa no tiene una suscripción de Mercado Pago.' }, { status: 409 })
  }

  try {
    const preapproval = await cancelPreapproval(context.company.mp_preapproval_id)
    await reconcilePreapproval(
      preapproval.id,
      `manual-cancel:${context.companyId}:${preapproval.last_modified || Date.now()}`
    )
    return NextResponse.json({ ok: true, status: preapproval.status })
  } catch (error) {
    console.error('Could not cancel subscription:', error)
    return NextResponse.json(
      { error: 'No pudimos cancelar la renovación en Mercado Pago.' },
      { status: 502 }
    )
  }
}
