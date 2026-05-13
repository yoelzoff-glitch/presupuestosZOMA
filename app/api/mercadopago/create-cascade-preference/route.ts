import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { getValidMercadoPagoAccessToken } from '@/lib/mercadopago/refreshAccessToken'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type CascadeItem = {
  budget_id: string
  budget_label: string
  balance_before: number
  allocated_amount: number
  balance_after: number
  order: number
}

/**
 * POST /api/mercadopago/create-cascade-preference
 * -------------------------------------------------------
 * Creates a single Mercado Pago payment that will be
 * distributed across multiple pending budgets (oldest first).
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

    // 2. Get customer data (company_id + client_id)
    const { data: customerData, error: customerError } = await supabase
      .from('customer_users')
      .select('company_id, client_id, active')
      .eq('auth_user_id', user.id)
      .single()

    if (customerError || !customerData?.client_id) {
      return NextResponse.json({ error: 'Usuario cliente no encontrado' }, { status: 403 })
    }

    if (!customerData.active) {
      return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 })
    }

    // 3. Parse body
    const body = await req.json()
    const amount = Number(body.amount || 0)

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
    }

    // 4. Get pending budgets ordered by date ASC (oldest first)
    const { data: budgets, error: budgetsError } = await supabaseAdmin
      .from('budgets')
      .select('id, budget_code, budget_number, budget_date, total_amount, paid_amount')
      .eq('company_id', customerData.company_id)
      .eq('client_id', customerData.client_id)
      .neq('status', 'cancelled')
      .order('budget_date', { ascending: true })
      .order('budget_number', { ascending: true })

    if (budgetsError || !budgets) {
      return NextResponse.json({ error: 'No se pudieron cargar los presupuestos' }, { status: 500 })
    }

    // 5. Cascade algorithm
    const items: CascadeItem[] = []
    let remaining = amount

    for (let i = 0; i < budgets.length; i++) {
      const budget = budgets[i]
      const balanceBefore = Number(budget.total_amount || 0) - Number(budget.paid_amount || 0)

      if (balanceBefore <= 0) continue // already paid — skip

      const allocated = Math.min(remaining, balanceBefore)

      items.push({
        budget_id: budget.id,
        budget_label: budget.budget_code || `000-${budget.budget_number}`,
        balance_before: balanceBefore,
        allocated_amount: allocated,
        balance_after: balanceBefore - allocated,
        order: items.length,
      })

      remaining -= allocated
      if (remaining <= 0) break
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'No hay presupuestos pendientes de pago' }, { status: 400 })
    }

    const actualAmount = amount - remaining // might be less if total debt < requested amount

    // 6. Store the cascade plan
    const { data: plan, error: planError } = await supabaseAdmin
      .from('cascade_payment_plans')
      .insert({
        company_id: customerData.company_id,
        client_id: customerData.client_id,
        total_amount: actualAmount,
        status: 'pending',
        items,
      })
      .select('id')
      .single()

    if (planError || !plan) {
      console.error('CASCADE PLAN INSERT ERROR:', planError)
      return NextResponse.json({ error: 'No se pudo crear el plan de pago' }, { status: 500 })
    }

    // 7. Get MP access token
    const accessToken = await getValidMercadoPagoAccessToken(customerData.company_id)

    if (!accessToken) {
      await supabaseAdmin.from('cascade_payment_plans').delete().eq('id', plan.id)
      return NextResponse.json({ error: 'No se pudo obtener token de Mercado Pago' }, { status: 400 })
    }

    // Detectamos la URL base dinámicamente para soportar servidores de prueba y local
    const host = req.headers.get('host')
    const protocol = host?.includes('localhost') ? 'http' : 'https'
    const dynamicAppUrl = `${protocol}://${host}`
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || dynamicAppUrl
    const externalReference = `cascade:${plan.id}`

    const budgetsSummary =
      items.length === 1
        ? items[0].budget_label
        : `${items.length} presupuestos`

    // 8. Create MP preference
    const preferenceResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: `Pago cuenta corriente — ${budgetsSummary}`,
            quantity: 1,
            currency_id: 'ARS',
            unit_price: Math.round(actualAmount),
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
      console.error('MP PREFERENCE ERROR:', preferenceData)
      await supabaseAdmin.from('cascade_payment_plans').delete().eq('id', plan.id)
      return NextResponse.json(
        { error: 'No se pudo crear la preferencia en Mercado Pago', detail: preferenceData },
        { status: 400 }
      )
    }

    // 9. Update plan with preference_id
    await supabaseAdmin
      .from('cascade_payment_plans')
      .update({ mp_preference_id: preferenceData.id, updated_at: new Date().toISOString() })
      .eq('id', plan.id)

    // 10. Record in payments table for tracking
    await supabaseAdmin.from('payments').insert({
      company_id: customerData.company_id,
      client_id: customerData.client_id,
      budget_id: null, // cascade — spans multiple budgets
      amount: actualAmount,
      status: 'pending',
      mp_preference_id: preferenceData.id,
      mp_external_reference: externalReference,
    })

    return NextResponse.json({
      preference_id: preferenceData.id,
      init_point: preferenceData.init_point,
      sandbox_init_point: preferenceData.sandbox_init_point,
      plan_id: plan.id,
      actual_amount: actualAmount,
      items,
    })
  } catch (error) {
    console.error('CREATE CASCADE PREFERENCE ERROR:', error)
    return NextResponse.json({ error: 'Error interno creando preferencia' }, { status: 500 })
  }
}
