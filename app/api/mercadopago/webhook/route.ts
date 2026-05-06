import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function handleWebhook(req: NextRequest) {
  try {
    const url = new URL(req.url)
    let body: any = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    console.log('MP WEBHOOK QUERY:', Object.fromEntries(url.searchParams))
    console.log('MP WEBHOOK BODY:', body)

    const paymentId =
        body?.data?.id ||
        body?.id ||
        url.searchParams.get('data.id') ||
        url.searchParams.get('id') ||
        url.searchParams.get('resource')?.split('/').pop()

    const topic =
      body?.type ||
      body?.topic ||
      url.searchParams.get('type') ||
      url.searchParams.get('topic')

    console.log('MP PAYMENT ID:', paymentId)
    console.log('MP TOPIC:', topic)

    if (!paymentId) {
      return NextResponse.json({ received: true, message: 'No payment id' })
    }

    const { data: mpAccounts, error: accountsError } = await supabaseAdmin
      .from('mp_accounts')
      .select('company_id, access_token')
      .eq('connected', true)

    if (accountsError || !mpAccounts?.length) {
      console.log('No MP accounts:', accountsError)
      return NextResponse.json({ received: true, message: 'No MP accounts' })
    }

    let mpPayment: any = null
    let companyId: string | null = null

    for (const account of mpAccounts) {
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
          },
        }
      )

      const text = await response.text()
      console.log('MP PAYMENT RESPONSE:', response.status, text)

      if (response.ok) {
        mpPayment = JSON.parse(text)
        companyId = account.company_id
        break
      }
    }

    if (!mpPayment || !companyId) {
      return NextResponse.json({ received: true, message: 'Payment not found' })
    }

    const mappedStatus =
      mpPayment.status === 'approved'
        ? 'approved'
        : mpPayment.status === 'rejected'
          ? 'rejected'
          : mpPayment.status === 'cancelled'
            ? 'cancelled'
            : mpPayment.status === 'refunded'
              ? 'refunded'
              : 'pending'

    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: mappedStatus,
        mp_payment_id: String(mpPayment.id),
        payment_method:
          mpPayment.payment_method_id ||
          mpPayment.payment_type_id ||
          null,
        paid_at: mappedStatus === 'approved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('mp_external_reference', mpPayment.external_reference)

    if (updateError) {
      console.log('PAYMENT UPDATE ERROR:', updateError)
    }

    return NextResponse.json({
      received: true,
      status: mappedStatus,
      external_reference: mpPayment.external_reference,
    })
  } catch (error) {
    console.error('MP WEBHOOK ERROR:', error)
    return NextResponse.json({ received: true })
  }
}

export async function POST(req: NextRequest) {
  return handleWebhook(req)
}

export async function GET(req: NextRequest) {
  return handleWebhook(req)
}