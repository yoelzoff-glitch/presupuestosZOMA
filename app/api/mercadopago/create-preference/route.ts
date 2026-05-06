import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { budget_id } = body

    if (!budget_id) {
      return NextResponse.json({ error: 'Falta budget_id' }, { status: 400 })
    }

    const { data: budget, error: budgetError } = await supabaseAdmin
      .from('budgets')
      .select(`
        id,
        company_id,
        client_id,
        budget_number,
        budget_code,
        total_amount,
        status,
        clients (
          name
        )
      `)
      .eq('id', budget_id)
      .single()

    if (budgetError || !budget) {
      return NextResponse.json(
        { error: 'Presupuesto no encontrado' },
        { status: 404 }
      )
    }

    if (budget.status === 'cancelled') {
      return NextResponse.json(
        { error: 'No se puede pagar un presupuesto anulado' },
        { status: 400 }
      )
    }

    if (!budget.total_amount || Number(budget.total_amount) <= 0) {
      return NextResponse.json(
        { error: 'El presupuesto no tiene importe válido' },
        { status: 400 }
      )
    }

    const { data: mpAccount, error: mpError } = await supabaseAdmin
      .from('mp_accounts')
      .select('access_token')
      .eq('company_id', budget.company_id)
      .eq('connected', true)
      .single()

    if (mpError || !mpAccount) {
      return NextResponse.json(
        { error: 'La empresa no tiene Mercado Pago conectado' },
        { status: 400 }
      )
    }

    const externalReference = `budget:${budget.id}`

    const preferenceResponse = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpAccount.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              title: `Presupuesto ${budget.budget_code || budget.budget_number}`,
              quantity: 1,
              currency_id: 'ARS',
              unit_price: Number(budget.total_amount),
            },
          ],
          external_reference: externalReference,
          notification_url: 'https://presupuestos-zoma.vercel.app/api/mercadopago/webhook',
        }),
      }
    )

    const preferenceData = await preferenceResponse.json()

    if (!preferenceResponse.ok) {
      console.error('MP preference error:', preferenceData)

      return NextResponse.json(
        {
          error: 'No se pudo crear la preferencia de pago',
          detail: preferenceData,
        },
        { status: 400 }
      )
    }

    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        company_id: budget.company_id,
        client_id: budget.client_id,
        budget_id: budget.id,
        amount: Number(budget.total_amount),
        status: 'pending',
        mp_preference_id: preferenceData.id,
        mp_external_reference: externalReference,
      })

    if (paymentError) {
      console.error('Payment insert error:', paymentError)

      return NextResponse.json(
        {
          error: 'Se creó la preferencia, pero no se pudo guardar el pago',
          detail: paymentError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      preference_id: preferenceData.id,
      init_point: preferenceData.init_point,
      sandbox_init_point: preferenceData.sandbox_init_point,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Error interno creando preferencia' },
      { status: 500 }
    )
  }
}