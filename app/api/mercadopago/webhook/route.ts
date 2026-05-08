import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidMercadoPagoAccessToken } from '@/lib/mercadopago/refreshAccessToken'
import { verifyMercadoPagoWebhookSignature } from '@/lib/mercadopago/verifyWebhookSignature'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type LocalPayment = {
  id: string
  company_id: string
  client_id: string
  budget_id: string | null
  amount: number
  status: string
}

async function createPaymentNotification(localPayment: LocalPayment) {
  const { data: existingNotification } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('company_id', localPayment.company_id)
    .eq('type', 'payment')
    .ilike('message', `%${localPayment.id}%`)
    .maybeSingle()

  if (existingNotification) {
    return
  }

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('name, cuit')
    .eq('id', localPayment.client_id)
    .eq('company_id', localPayment.company_id)
    .maybeSingle()

  const { data: budget } = localPayment.budget_id
    ? await supabaseAdmin
        .from('budgets')
        .select('budget_code, budget_number')
        .eq('id', localPayment.budget_id)
        .eq('company_id', localPayment.company_id)
        .maybeSingle()
    : { data: null }

  const clientName = client?.name || 'Un cliente'
  const budgetLabel =
    budget?.budget_code ||
    (budget?.budget_number ? `000-${budget.budget_number}` : 'un presupuesto')

  const amount = Number(localPayment.amount || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const link = localPayment.budget_id
    ? `/presupuestos/${localPayment.budget_id}`
    : '/cuenta-corriente'

  const { error } = await supabaseAdmin.from('notifications').insert({
    company_id: localPayment.company_id,
    title: 'Pago recibido',
    message: `${clientName} pagó ${amount} por Mercado Pago para el presupuesto ${budgetLabel}. Ref. pago interno: ${localPayment.id}`,
    type: 'payment',
    link,
    read: false,
  })

  if (error) {
    console.log('PAYMENT NOTIFICATION INSERT ERROR:', error)
  }
}

async function handleWebhook(req: NextRequest) {
  const isValidSignature = verifyMercadoPagoWebhookSignature(req)

  if (!isValidSignature) {
    console.error('Firma webhook Mercado Pago inválida')

    return NextResponse.json(
      {
        received: false,
        error: 'Invalid signature',
      },
      {
        status: 401,
      }
    )
  }

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

    const mpUserId = body?.user_id || url.searchParams.get('user_id')

    let query = supabaseAdmin
      .from('mp_accounts')
      .select('company_id, access_token')
      .eq('connected', true)

    if (mpUserId) {
      query = query.eq('mp_user_id', mpUserId)
    }

    const { data: mpAccounts, error: accountsError } = await query

    if (accountsError || !mpAccounts?.length) {
      console.log('No MP accounts:', accountsError)
      return NextResponse.json({ received: true, message: 'No MP accounts' })
    }

    let mpPayment: any = null
    let companyId: string | null = null

    for (const account of mpAccounts) {
      const validAccessToken = await getValidMercadoPagoAccessToken(
        account.company_id
      )

      if (!validAccessToken) {
        continue
      }

      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${validAccessToken}`,
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

    const { data: previousPayment, error: previousPaymentError } =
      await supabaseAdmin
        .from('payments')
        .select('id, company_id, client_id, budget_id, amount, status')
        .eq('company_id', companyId)
        .eq('mp_external_reference', mpPayment.external_reference)
        .maybeSingle()

    if (previousPaymentError) {
      console.log('PREVIOUS PAYMENT READ ERROR:', previousPaymentError)
    }

    const wasAlreadyApproved = previousPayment?.status === 'approved'

    const updatePayload = {
      status: mappedStatus,
      mp_payment_id: String(mpPayment.id),
      payment_method:
        mpPayment.payment_method_id || mpPayment.payment_type_id || null,
      paid_at: mappedStatus === 'approved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    const { data: updatedPayments, error: updateError } = await supabaseAdmin
      .from('payments')
      .update(updatePayload)
      .eq('company_id', companyId)
      .eq('mp_external_reference', mpPayment.external_reference)
      .select('id, company_id, client_id, budget_id, amount, status')
      .limit(1)

    if (updateError) {
      console.log('PAYMENT UPDATE ERROR:', updateError)
    }

    const localPayment = updatedPayments?.[0]

    if (mappedStatus === 'approved' && localPayment) {
      const { data: existingMovement } = await supabaseAdmin
        .from('account_movements')
        .select('id')
        .eq('payment_id', localPayment.id)
        .maybeSingle()

      if (!existingMovement) {
        const { error: movementError } = await supabaseAdmin
          .from('account_movements')
          .insert({
            company_id: localPayment.company_id,
            client_id: localPayment.client_id,
            budget_id: localPayment.budget_id,
            payment_id: localPayment.id,
            movement_type: 'Pago',
            payment_type: 'Pago total',
            description: `Pago Mercado Pago - ${mpPayment.id}`,
            debit: 0,
            credit: Number(localPayment.amount),
          })

        if (movementError) {
          console.log('ACCOUNT MOVEMENT INSERT ERROR:', movementError)
        }
      }

      if (!wasAlreadyApproved) {
        await createPaymentNotification(localPayment as LocalPayment)
      }

      if (localPayment.budget_id) {
        const { data: approvedPayments, error: approvedPaymentsError } =
          await supabaseAdmin
            .from('payments')
            .select('amount')
            .eq('budget_id', localPayment.budget_id)
            .eq('status', 'approved')

        if (approvedPaymentsError) {
          console.log('APPROVED PAYMENTS ERROR:', approvedPaymentsError)
        }

        const totalPaid =
          approvedPayments?.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
          ) || 0

        const { data: budget, error: budgetError } = await supabaseAdmin
          .from('budgets')
          .select('total_amount')
          .eq('id', localPayment.budget_id)
          .single()

        if (budgetError) {
          console.log('BUDGET READ ERROR:', budgetError)
        }

        if (budget) {
          const totalAmount = Number(budget.total_amount || 0)

          const paymentStatus =
            totalPaid <= 0
              ? 'unpaid'
              : totalPaid >= totalAmount
                ? 'paid'
                : 'partial'

          const { error: budgetUpdateError } = await supabaseAdmin
            .from('budgets')
            .update({
              payment_status: paymentStatus,
              paid_amount: totalPaid,
              paid_at:
                paymentStatus === 'paid' ? new Date().toISOString() : null,
            })
            .eq('id', localPayment.budget_id)

          if (budgetUpdateError) {
            console.log('BUDGET UPDATE ERROR:', budgetUpdateError)
          }
        }
      }
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