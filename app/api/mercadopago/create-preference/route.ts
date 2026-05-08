import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { getValidMercadoPagoAccessToken } from '@/lib/mercadopago/refreshAccessToken'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/mercadopago/create-preference
 * ------------------------------------------------------------
 * Creates a Mercado Pago payment preference for a budget.
 *
 * Security fix:
 *   - Authenticates the user.
 *   - If Admin: Verifies they belong to the company that owns the budget.
 *   - If Customer: Verifies the budget belongs to their client_id.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Get user profile and role
    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })
    }

    const body = await req.json()
    const { budget_id, order_code } = body

    if (!budget_id && !order_code) {
      return NextResponse.json({ error: 'Falta budget_id u order_code' }, { status: 400 })
    }

    let paymentData: {
      id: string
      company_id: string
      client_id: string
      title: string
      balance: number
      external_reference: string
    } | null = null

    if (budget_id) {
      // 3. Fetch budget and verify ownership
      const { data: budget, error: budgetError } = await supabaseAdmin
        .from('budgets')
        .select(`
          id,
          company_id,
          client_id,
          budget_number,
          budget_code,
          total_amount,
          paid_amount,
          status
        `)
        .eq('id', budget_id)
        .single()

      if (budgetError || !budget) {
        return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
      }

      if (budget.status === 'cancelled') {
        return NextResponse.json({ error: 'No se puede pagar un presupuesto anulado' }, { status: 400 })
      }

      const balance = Number(budget.total_amount || 0) - Number(budget.paid_amount || 0)

      paymentData = {
        id: budget.id,
        company_id: budget.company_id,
        client_id: budget.client_id,
        title: `Presupuesto ${budget.budget_code || budget.budget_number}`,
        balance: balance,
        external_reference: `budget:${budget.id}`,
      }
    } else {
      // 3b. Fetch order and verify ownership
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select(`
          id,
          company_id,
          client_id,
          order_code,
          total_amount,
          status
        `)
        .eq('order_code', order_code)
        .single()

      if (orderError || !order) {
        return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
      }

      if (order.status === 'cancelled') {
        return NextResponse.json({ error: 'No se puede pagar un pedido anulado' }, { status: 400 })
      }

      // Por ahora tomamos el total_amount como balance. 
      // (En una versión más avanzada podríamos restar pagos parciales si existieran en orders)
      const balance = Number(order.total_amount || 0)

      paymentData = {
        id: order.id,
        company_id: order.company_id,
        client_id: order.client_id,
        title: `Pedido ${order.order_code}`,
        balance: balance,
        external_reference: `order:${order.id}`,
      }
    }

    if (!paymentData) {
      return NextResponse.json({ error: 'No se pudieron obtener los datos de pago' }, { status: 400 })
    }

    // Authorization logic
    if (profile.role === 'customer') {
      // Check if this customer user belongs to the client in the document
      const { data: customerData } = await supabaseAdmin
        .from('customer_users')
        .select('client_id')
        .eq('auth_user_id', user.id)
        .single()

      if (!customerData || customerData.client_id !== paymentData.client_id) {
        return NextResponse.json({ error: 'No tenés permiso para pagar este documento' }, { status: 403 })
      }
    } else {
      // Admin/User: Must belong to the same company
      if (profile.company_id !== paymentData.company_id) {
        return NextResponse.json({ error: 'No tenés permiso para esta empresa' }, { status: 403 })
      }
    }

    // 4. Validations
    if (paymentData.balance <= 0) {
      return NextResponse.json({ error: 'El documento ya se encuentra pagado' }, { status: 400 })
    }

    // 5. Get MP Access Token
    const accessToken = await getValidMercadoPagoAccessToken(paymentData.company_id)

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No se pudo obtener un token válido de Mercado Pago' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://presupuestos-zoma.vercel.app'
    const externalReference = paymentData.external_reference

    // 6. Create Preference
    const preferenceResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: paymentData.title,
            quantity: 1,
            currency_id: 'ARS',
            unit_price: Math.round(Number(paymentData.balance)),
          },
        ],
        external_reference: externalReference,
        notification_url: `${appUrl}/api/mercadopago/webhook`,
        back_urls: {
          success: `${appUrl}/portal/pagos/success`,
          failure: `${appUrl}/portal/pagos/failure`,
          pending: `${appUrl}/portal/pagos/pending`,
        },
        auto_return: 'approved',
        binary_mode: true,
      }),
    })

    const preferenceData = await preferenceResponse.json()

    if (!preferenceResponse.ok) {
      console.error('MP preference error:', preferenceData)
      return NextResponse.json(
        { error: 'No se pudo crear la preferencia de pago', detail: preferenceData },
        { status: 400 }
      )
    }

    // 7. Store pending payment
    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        company_id: paymentData.company_id,
        client_id: paymentData.client_id,
        budget_id: budget_id || null,
        amount: Number(paymentData.balance),
        status: 'pending',
        mp_preference_id: preferenceData.id,
        mp_external_reference: externalReference,
      })

    if (paymentError) {
      console.error('Payment insert error:', paymentError)
      return NextResponse.json(
        { error: 'Se creó la preferencia, pero no se pudo guardar el pago', detail: paymentError.message },
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
    return NextResponse.json({ error: 'Error interno creando preferencia' }, { status: 500 })
  }
}