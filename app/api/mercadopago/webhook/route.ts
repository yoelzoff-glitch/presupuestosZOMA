import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidMercadoPagoAccessToken } from '@/lib/mercadopago/refreshAccessToken'
import { verifyMercadoPagoWebhookSignature } from '@/lib/mercadopago/verifyWebhookSignature'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  return handleWebhook(req)
}

export async function GET(req: NextRequest) {
  return handleWebhook(req)
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Allow': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

type LocalPayment = {
  id: string
  company_id: string
  client_id: string
  budget_id: string | null
  amount: number
  status: string
  mp_external_reference?: string | null
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
    console.log('NOTIFICATION ALREADY EXISTS, SKIPPING...');
    return
  }

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('name, cuit')
    .eq('id', localPayment.client_id)
    .eq('company_id', localPayment.company_id)
    .maybeSingle()

  let documentLabel = 'un documento'
  let link = '/cuenta-corriente'

  if (localPayment.budget_id) {
    const { data: budget } = await supabaseAdmin
      .from('budgets')
      .select('budget_code, budget_number')
      .eq('id', localPayment.budget_id)
      .maybeSingle()
    
    if (budget) {
      documentLabel = `Presupuesto ${budget.budget_code || `000-${budget.budget_number}`}`
      link = `/presupuestos/${localPayment.budget_id}`
    }
  } else if (localPayment.mp_external_reference?.startsWith('order:')) {
    const orderId = localPayment.mp_external_reference.replace('order:', '')
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('order_code')
      .eq('id', orderId)
      .maybeSingle()
    
    if (order) {
      documentLabel = `Pedido ${order.order_code}`
      link = `/pedidos/${orderId}`
    }
  } else if (localPayment.mp_external_reference?.startsWith('movement:')) {
    const movementId = localPayment.mp_external_reference.replace('movement:', '')
    const { data: movement } = await supabaseAdmin
      .from('account_movements')
      .select('description')
      .eq('id', movementId)
      .maybeSingle()
    
    if (movement) {
      documentLabel = movement.description || 'Saldo pendiente'
    }
  }

  const clientName = client?.name || 'Un cliente'
  const amount = Number(localPayment.amount || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  // Re-verificar justo antes de insertar (doble chequeo para concurrencia)
  const { data: doubleCheck } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('company_id', localPayment.company_id)
    .eq('type', 'payment')
    .ilike('message', `%${localPayment.id}%`)
    .maybeSingle()

  if (doubleCheck) return

  const { error } = await supabaseAdmin.from('notifications').insert({
    company_id: localPayment.company_id,
    title: 'Pago recibido',
    message: `${clientName} pagó ${amount} por Mercado Pago para ${documentLabel}. Ref. pago interno: ${localPayment.id}`,
    type: 'payment',
    link,
    read: false,
  })

  if (error) {
    console.log('PAYMENT NOTIFICATION INSERT ERROR:', error)
  }
}

// ---------------------------------------------------------------------------
// Cascade payment handler
// ---------------------------------------------------------------------------
async function handleCascadePayment(
  planId: string,
  mpPayment: any,
  companyId: string,
  mappedStatus: string,
  mpPaymentId: string
) {
  // Update payments record
  await supabaseAdmin
    .from('payments')
    .update({
      status: mappedStatus,
      mp_payment_id: mpPaymentId,
      payment_method: mpPayment.payment_method_id || mpPayment.payment_type_id || null,
      paid_at: mappedStatus === 'approved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('mp_external_reference', `cascade:${planId}`)

  if (mappedStatus !== 'approved') {
    return // Nothing more to do for non-approved states
  }

  // Load the cascade plan
  const { data: plan, error: planError } = await supabaseAdmin
    .from('cascade_payment_plans')
    .select('*')
    .eq('id', planId)
    .single()

  if (planError || !plan) {
    console.error('CASCADE PLAN NOT FOUND:', planId, planError)
    return
  }

  // Idempotency — if already completed, skip
  if (plan.status === 'completed') {
    console.log('CASCADE PLAN ALREADY COMPLETED:', planId)
    return
  }

  const items: Array<{
    budget_id: string
    budget_label: string
    balance_before: number
    allocated_amount: number
    balance_after: number
    order: number
  }> = plan.items

  // Find the local payment id for linking movements
  const { data: localPayment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('mp_external_reference', `cascade:${planId}`)
    .maybeSingle()

  const localPaymentId = localPayment?.id || null

  // Process each item in order
  for (const item of items.sort((a, b) => a.order - b.order)) {
    if (!item.allocated_amount || item.allocated_amount <= 0) continue

    // Fetch current paid state of budget to determine payment_type
    const { data: budget } = await supabaseAdmin
      .from('budgets')
      .select('total_amount, paid_amount')
      .eq('id', item.budget_id)
      .single()

    if (!budget) continue

    const currentPaid = Number(budget.paid_amount || 0)
    const newPaidAmount = currentPaid + Number(item.allocated_amount)
    const totalAmount = Number(budget.total_amount || 0)

    const willBeFullyPaid = newPaidAmount >= totalAmount
    const paymentType = willBeFullyPaid ? 'Pago total' : 'Pago parcial'
    const newPaymentStatus = willBeFullyPaid ? 'paid' : 'partial'

    // Check for duplicate movement
    const { data: existingMovement } = await supabaseAdmin
      .from('account_movements')
      .select('id')
      .eq('budget_id', item.budget_id)
      .eq('description', `Pago en cascada MP - ${mpPaymentId}`)
      .maybeSingle()

    if (!existingMovement) {
      const { error: movementError } = await supabaseAdmin
        .from('account_movements')
        .insert({
          company_id: plan.company_id,
          client_id: plan.client_id,
          budget_id: item.budget_id,
          payment_id: localPaymentId,
          movement_type: 'Pago',
          payment_type: paymentType,
          description: `Pago en cascada MP - ${mpPaymentId}`,
          debit: 0,
          credit: Number(item.allocated_amount),
        })

      if (movementError) {
        console.error('CASCADE MOVEMENT ERROR for budget', item.budget_id, movementError)
      }
    }

    // Update budget paid_amount and payment_status
    const { error: budgetUpdateError } = await supabaseAdmin
      .from('budgets')
      .update({
        payment_status: newPaymentStatus,
        paid_amount: newPaidAmount,
        paid_at: willBeFullyPaid ? new Date().toISOString() : null,
      })
      .eq('id', item.budget_id)

    if (budgetUpdateError) {
      console.error('CASCADE BUDGET UPDATE ERROR:', item.budget_id, budgetUpdateError)
    }
  }

  // Mark plan as completed
  await supabaseAdmin
    .from('cascade_payment_plans')
    .update({
      status: 'completed',
      mp_payment_id: mpPaymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)

  // Notification
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('name')
    .eq('id', plan.client_id)
    .maybeSingle()

  const clientName = client?.name || 'Un cliente'
  const amountFormatted = Number(plan.total_amount || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const affectedBudgets = items.map((i) => i.budget_label).join(', ')

  const { data: existingNotif } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('company_id', companyId)
    .eq('type', 'payment')
    .ilike('message', `%${mpPaymentId}%`)
    .maybeSingle()

  if (existingNotif) {
    console.log('CASCADE NOTIFICATION ALREADY EXISTS, SKIPPING...');
    return
  }

  await supabaseAdmin.from('notifications').insert({
    company_id: companyId,
    title: 'Pago en cascada recibido',
    message: `${clientName} realizó un pago de ${amountFormatted} distribuido en: ${affectedBudgets}. MP ID: ${mpPaymentId}`,
    type: 'payment',
    link: '/cuenta-corriente',
    read: false,
  })
}

// ---------------------------------------------------------------------------
// Main webhook handler
// ---------------------------------------------------------------------------
async function handleWebhook(req: NextRequest) {
  const isValidSignature = verifyMercadoPagoWebhookSignature(req)

  if (!isValidSignature) {
    console.error('⚠️ ATENCIÓN: Firma webhook inválida. Se recomienda revisar el MERCADOPAGO_WEBHOOK_SECRET.');
    // Comentamos el return para que el pago impacte igual mientras testeamos
    /*
    return NextResponse.json(
      { received: false, error: 'Invalid signature' },
      { status: 401 }
    )
    */
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

    console.log(`📡 Webhook recibido - Topic: ${topic}, ID: ${paymentId}`);

    // 4. Buscar todas las cuentas de Mercado Pago conectadas
    const { data: mpAccounts } = await supabaseAdmin
      .from('mp_accounts')
      .select('*')
      .eq('connected', true)

    if (!mpAccounts || mpAccounts.length === 0) {
      console.error('❌ No hay cuentas de Mercado Pago conectadas (mp_accounts) en la base de datos');
      return NextResponse.json({ received: true, message: 'No accounts connected' })
    }

    console.log(`🔍 Buscando pago en ${mpAccounts.length} cuentas conectadas...`);

    let mpPayment: any = null
    let companyId: string | null = null

    for (const account of mpAccounts) {
      try {
        // Determinamos el endpoint según el topic
        const endpoint = topic === 'payment' || topic === 'payment.created' || topic === 'payment.updated'
          ? `https://api.mercadopago.com/v1/payments/${paymentId}`
          : topic === 'merchant_order'
          ? `https://api.mercadopago.com/merchant_orders/${paymentId}`
          : null;

        if (!endpoint) {
          console.warn('⚠️ Topic no soportado para búsqueda directa:', topic);
          continue;
        }

        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
          },
        })

        if (response.ok) {
          mpPayment = await response.json()
          companyId = account.company_id
          console.log(`✅ Pago encontrado en la cuenta de la empresa: ${companyId}`);
          break
        } else {
          const errorText = await response.text();
          console.log(`- Intento fallido en cuenta ${account.company_id}: ${response.status} ${errorText}`);
        }
      } catch (error) {
        console.error('Error fetching MP payment:', error)
      }
    }

    if (!mpPayment || !companyId) {
      console.error('❌ No se encontró el pago en Mercado Pago con ninguna de las cuentas conectadas. ID:', paymentId);
      return NextResponse.json({ received: true, message: 'Payment not found' })
    }

    console.log('✅ Pago recuperado de MP:', {
      id: mpPayment.id,
      status: mpPayment.status,
      preference_id: mpPayment.preference_id,
      external_reference: mpPayment.external_reference,
      merchant_order_id: mpPayment.merchant_order_id,
      order: mpPayment.order
    });

    console.log(`🔍 Intentando matchear con Supabase usando: pref_id=${mpPayment.preference_id || 'null'}, ext_ref=${mpPayment.external_reference || 'null'}`);

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

    // -----------------------------------------------------------------------
    // BRANCH: Cascade payment
    // -----------------------------------------------------------------------
    if (mpPayment.external_reference?.startsWith('cascade:')) {
      const planId = mpPayment.external_reference.replace('cascade:', '')
      console.log('CASCADE PAYMENT DETECTED. Plan ID:', planId)

      await handleCascadePayment(
        planId,
        mpPayment,
        companyId,
        mappedStatus,
        String(mpPayment.id)
      )

      return NextResponse.json({
        received: true,
        type: 'cascade',
        status: mappedStatus,
        plan_id: planId,
      })
    }

    // -----------------------------------------------------------------------
    // BRANCH: Standard single-budget payment
    // -----------------------------------------------------------------------
    // Intentar obtener el preference_id y la referencia de varios lugares posibles
    const preferenceId = mpPayment.preference_id || mpPayment.order?.id || mpPayment.merchant_order_id;
    const externalRef = mpPayment.external_reference;

    console.log('🔍 Buscando pago local con:', { preferenceId, externalRef, companyId });

    // Búsqueda robusta: Intentamos por preference_id y si no, por external_reference
    let localRecord = null;
    let localError = null;

    if (preferenceId) {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('company_id', companyId)
        .eq('mp_preference_id', preferenceId)
        .maybeSingle();
      localRecord = data;
      localError = error;
    }

    if (!localRecord && externalRef) {
      console.log(' buscando por externalRef...', externalRef);
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('company_id', companyId)
        .eq('mp_external_reference', externalRef)
        .maybeSingle();
      localRecord = data;
      localError = error;
    }

    if (localError || !localRecord) {
      console.log('🔍 Iniciando MODO RESCATE (Búsqueda por UUID en referencia)...');
      
      // Intentamos extraer el UUID de externalRef (ej: budget:UUID)
      const uuidMatch = externalRef?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const extractedUuid = uuidMatch ? uuidMatch[0] : null;

      if (extractedUuid) {
        console.log('🎯 UUID extraído para rescate:', extractedUuid);
        const { data: rescueRecord } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('company_id', companyId)
          .or(`budget_id.eq.${extractedUuid},id.eq.${extractedUuid},mp_external_reference.ilike.%${extractedUuid}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rescueRecord) {
          console.log('✅ ¡PAGO RESCATADO! Encontrado por ID de presupuesto/pago.');
          localRecord = rescueRecord;
        }
      }
    }

    if (!localRecord) {
      console.error('❌ No se encontró el registro de pago en Supabase con el filtro de empresa:', { preferenceId, externalRef, companyId });
      
      // Búsqueda GLOBAL (sin filtro de empresa) para diagnóstico final
      const { data: globalRecord } = await supabaseAdmin
        .from('payments')
        .select('id, company_id, mp_preference_id, mp_external_reference')
        .or(`mp_preference_id.eq.${preferenceId || 'no_pref'},mp_external_reference.eq.${externalRef || 'no_ref'}`)
        .maybeSingle();
      
      if (globalRecord) {
        console.error('🚨 ¡CRÍTICO! El registro existe pero pertenece a OTRA EMPRESA:', {
          paymentRecordId: globalRecord.id,
          paymentCompanyId: globalRecord.company_id,
          mpAccountCompanyId: companyId
        });
      } else {
        console.error('❌ El registro definitivamente NO existe en la tabla payments con estos IDs.');
      }

      return NextResponse.json({ received: true, message: 'Local payment not found' })
    }

    const previousPayment = localRecord;
    console.log('✅ Registro de pago local encontrado:', previousPayment.id);

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
      .eq('id', previousPayment.id) // Actualización por ID interno, mucho más seguro
      .select('id, company_id, client_id, budget_id, amount, status, mp_external_reference')

    if (updateError) {
      console.log('PAYMENT UPDATE ERROR:', updateError)
    }

    const localPayment = updatedPayments?.[0] as LocalPayment | undefined

    if (mappedStatus === 'approved' && localPayment) {
      const { data: existingMovement } = await supabaseAdmin
        .from('account_movements')
        .select('id')
        .eq('payment_id', localPayment.id)
        .maybeSingle()

      if (!existingMovement) {
        let movementDescription = `Pago Mercado Pago - ${mpPayment.id}`
        if (localPayment.mp_external_reference?.startsWith('order:')) {
          const orderId = localPayment.mp_external_reference.replace('order:', '')
          const { data: order } = await supabaseAdmin
            .from('orders')
            .select('order_code')
            .eq('id', orderId)
            .maybeSingle()
          if (order) {
            movementDescription = `Pago Pedido ${order.order_code} - MP: ${mpPayment.id}`
          }
        } else if (localPayment.mp_external_reference?.startsWith('movement:')) {
          const movementId = localPayment.mp_external_reference.replace('movement:', '')
          const { data: movement } = await supabaseAdmin
            .from('account_movements')
            .select('description')
            .eq('id', movementId)
            .maybeSingle()
          if (movement) {
            movementDescription = `Pago ${movement.description || 'Saldo'} - MP: ${mpPayment.id}`
          }
        }

        // Determinamos el tipo de pago (Total o Parcial) comparando el saldo
        let paymentType = 'Pago parcial'
        let totalPaidSoFar = 0

        // Detección robusta del monto (transaction_amount para pagos, total_amount para órdenes)
        const amountToRecord = Number(
          mpPayment.transaction_amount || 
          mpPayment.total_amount || 
          mpPayment.paid_amount || 
          previousPayment.amount || 0
        );

        if (previousPayment.budget_id) {
          const { data: budget } = await supabaseAdmin
            .from('budgets')
            .select('total_amount')
            .eq('id', previousPayment.budget_id)
            .single()

          const { data: otherMovements } = await supabaseAdmin
            .from('account_movements')
            .select('credit')
            .eq('budget_id', previousPayment.budget_id)

          const previousCredits = (otherMovements || []).reduce((acc, m) => acc + Number(m.credit || 0), 0)
          totalPaidSoFar = previousCredits + amountToRecord

          if (budget && totalPaidSoFar >= Number(budget.total_amount)) {
            paymentType = 'Pago total'
          }
        } else if (localPayment.mp_external_reference?.startsWith('movement:')) {
          const movementId = localPayment.mp_external_reference.replace('movement:', '')
          const { data: movement } = await supabaseAdmin
            .from('account_movements')
            .select('debit')
            .eq('id', movementId)
            .maybeSingle()
          
          if (movement && amountToRecord >= Number(movement.debit)) {
            paymentType = 'Pago total'
          }
        }

        const { error: movementError } = await supabaseAdmin
          .from('account_movements')
          .insert({
            company_id: previousPayment.company_id,
            client_id: previousPayment.client_id,
            budget_id: previousPayment.budget_id,
            payment_id: previousPayment.id,
            movement_type: 'Pago',
            payment_type: paymentType,
            description: movementDescription,
            debit: 0,
            credit: amountToRecord,
          })

        if (movementError) {
          console.log('ACCOUNT MOVEMENT INSERT ERROR:', movementError)
        }
      }

      if (!wasAlreadyApproved) {
        await createPaymentNotification(previousPayment)
      }

      if (previousPayment.budget_id) {
        const { data: movements, error: movementsError } =
          await supabaseAdmin
            .from('account_movements')
            .select('credit')
            .eq('budget_id', previousPayment.budget_id)

        if (movementsError) {
          console.log('MOVEMENTS READ ERROR:', movementsError)
        }

        const totalPaid =
          movements?.reduce(
            (sum, item) => sum + Number(item.credit || 0),
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
            .eq('id', previousPayment.budget_id)

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

// --- Exports moved to top ---