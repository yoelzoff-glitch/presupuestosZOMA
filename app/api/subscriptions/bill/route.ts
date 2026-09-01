import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyUser } from '@/lib/auth/requireCompanyUser'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const auth = await requireCompanyUser({ allowedRoles: ['admin', 'super_admin'] })
  if (!auth.success) return auth.response

  const { companyId } = auth.user
  const supabase = createSupabaseAdminClient()
  
  let newBudgetId: string | null = null
  let newInvoiceId: string | null = null

  try {
    const { 
      subscription_id, 
      custom_amount, 
      service_desde, 
      service_hasta, 
      service_vto,
      cbteTipoOverride
    } = await request.json().catch(() => ({}))

    if (!subscription_id) {
      return NextResponse.json({ success: false, error: 'Falta subscription_id' }, { status: 400 })
    }

    // 1. Obtener los datos del abono validando pertenencia a la empresa autenticada
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .eq('company_id', companyId)
      .single()

    if (subError || !sub) {
      throw new Error('Abono no encontrado en el sistema o no pertenece a su empresa')
    }

    // 2. Escalar ítems si hay un monto personalizado
    let itemsToSave = sub.items || []
    const totalAmount = custom_amount ? Number(custom_amount) : Number(sub.total_amount)

    if (custom_amount && sub.total_amount > 0 && Math.abs(Number(custom_amount) - Number(sub.total_amount)) > 0.01) {
      const scale = Number(custom_amount) / Number(sub.total_amount)
      itemsToSave = (sub.items || []).map((item: any) => ({
        ...item,
        unit_price: parseFloat((Number(item.unit_price) * scale).toFixed(2))
      }))
    }

    // 3. Generar número de presupuesto secuencial
    const { data: lastBudgetData, error: lastBudgetError } = await supabase
      .from('budgets')
      .select('budget_number')
      .eq('company_id', companyId)
      .order('budget_number', { ascending: false })
      .limit(1)

    if (lastBudgetError) {
      throw new Error(`Error al obtener el último número de presupuesto: ${lastBudgetError.message}`)
    }

    const nextBudgetNumber = lastBudgetData && lastBudgetData.length > 0
      ? Number(lastBudgetData[0].budget_number) + 1
      : 1950

    // 4. Crear registro en la tabla budgets
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .insert({
        company_id: companyId,
        client_id: sub.client_id,
        budget_number: nextBudgetNumber,
        budget_date: new Date().toISOString().split('T')[0],
        total_amount: totalAmount,
        status: 'approved',
        notes: `Cobro mensual de abono: ${sub.name}`
      })
      .select('id')
      .single()

    if (budgetError || !budget) {
      throw new Error(`Error al crear presupuesto para abono: ${budgetError?.message}`)
    }

    newBudgetId = budget.id

    // 5. Copiar ítems del abono a budget_items
    const budgetItemsToInsert = itemsToSave.map((item: any) => ({
      budget_id: budget.id,
      company_id: companyId,
      product_id: item.product_id || null,
      product_name: item.product_name,
      product_code: item.product_code || null,
      category: item.category || null,
      quantity: item.quantity,
      unit_price: item.unit_price
    }))

    const { error: itemsError } = await supabase
      .from('budget_items')
      .insert(budgetItemsToInsert)

    if (itemsError) {
      throw new Error(`Error al insertar ítems del presupuesto: ${itemsError.message}`)
    }

    // 6. Crear borrador de factura en la tabla invoices
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        company_id: companyId,
        client_id: sub.client_id,
        budget_id: budget.id,
        total_amount: totalAmount,
        status: 'draft',
        afip_comprobante_tipo: cbteTipoOverride || null,
        invoice_date: new Date().toISOString().split('T')[0]
      })
      .select('id')
      .single()

    if (invoiceError || !invoice) {
      throw new Error(`Error al crear borrador de factura: ${invoiceError?.message}`)
    }

    newInvoiceId = invoice.id

    // 7. Copiar ítems a invoice_items
    const invoiceItemsToInsert = itemsToSave.map((item: any) => ({
      invoice_id: invoice.id,
      product_id: item.product_id || null,
      product_name: item.product_name,
      product_code: item.product_code || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: parseFloat((Number(item.quantity) * Number(item.unit_price)).toFixed(2))
    }))

    const { error: invItemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItemsToInsert)

    if (invItemsError) {
      throw new Error(`Error al copiar ítems a la factura: ${invItemsError.message}`)
    }

    // 8. Invocar la API oficial de AFIP
    const afipResponse = await fetch(`${request.nextUrl.origin}/api/afip/create-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        budget_id: budget.id,
        cbteTipoOverride: cbteTipoOverride || null,
        customAmount: totalAmount,
        serviceDates: {
          FchServDesde: service_desde,
          FchServHasta: service_hasta,
          FchVtoPago: service_vto
        }
      })
    })

    const afipResult = await afipResponse.json()

    if (!afipResponse.ok || !afipResult.success) {
      throw new Error(afipResult.error || 'Fallo en la autorización ante AFIP')
    }

    // 9. Actualizar last_billed_month en abono para evitar dobles cobros
    const currentMonthLabel = (service_desde || new Date().toISOString()).slice(0, 7)
    
    await supabase
      .from('subscriptions')
      .update({
        last_billed_month: currentMonthLabel,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription_id)

    return NextResponse.json({
      success: true,
      cae: afipResult.cae,
      invoice_number: afipResult.invoice_number,
      budget_id: budget.id,
      message: 'Abono facturado y autorizado ante AFIP correctamente.'
    })

  } catch (error: any) {
    console.error('❌ Error facturando abono:', error.message)

    // Rollback de base de datos para mantener integridad en caso de fallos AFIP/ARCA
    try {
      if (newInvoiceId) {
        await supabase.from('invoices').delete().eq('id', newInvoiceId)
      }
      if (newBudgetId) {
        await supabase.from('budgets').delete().eq('id', newBudgetId)
      }
    } catch (cleanupError) {
      console.error('Error durante rollback:', cleanupError)
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno facturando abono'
    }, { status: 500 })
  }
}
