import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const paymentId =
      body?.data?.id ||
      body?.id ||
      body?.resource?.split('/').pop()

    if (!paymentId) {
      return NextResponse.json({ received: true })
    }

    const { data: mpAccounts } = await supabaseAdmin
      .from('mp_accounts')
      .select('company_id, access_token')
      .eq('connected', true)

    if (!mpAccounts || mpAccounts.length === 0) {
      return NextResponse.json({ received: true })
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

      if (response.ok) {
        mpPayment = await response.json()
        companyId = account.company_id
        break
      }
    }

    if (!mpPayment || !companyId) {
      return NextResponse.json({ received: true })
    }

    const externalReference = mpPayment.external_reference
    const status = mpPayment.status

    const mappedStatus =
      status === 'approved'
        ? 'approved'
        : status === 'rejected'
          ? 'rejected'
          : status === 'cancelled'
            ? 'cancelled'
            : status === 'refunded'
              ? 'refunded'
              : 'pending'

    const paymentMethod =
      mpPayment.payment_method_id ||
      mpPayment.payment_type_id ||
      null

    const updateData: any = {
      status: mappedStatus,
      mp_payment_id: String(mpPayment.id),
      payment_method: paymentMethod,
      updated_at: new Date().toISOString(),
    }

    if (mappedStatus === 'approved') {
      updateData.paid_at = new Date().toISOString()
    }

    await supabaseAdmin
      .from('payments')
      .update(updateData)
      .eq('company_id', companyId)
      .eq('mp_external_reference', externalReference)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('MP webhook error:', error)
    return NextResponse.json({ received: true })
  }
}