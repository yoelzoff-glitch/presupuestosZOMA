import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseAdminClient()
    const { budget_id, cbteTipo } = await request.json()

    if (!budget_id) {
      return NextResponse.json({ success: false, error: 'Budget ID is required' }, { status: 400 })
    }

    // 1. Obtener datos del presupuesto y sus ítems
    const { data: budget, error: bError } = await supabase
      .from('budgets')
      .select('*, budget_items(*)')
      .eq('id', budget_id)
      .single()

    if (bError || !budget) {
      return NextResponse.json({ success: false, error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    // 2. Crear la factura en estado 'draft'
    const { data: invoice, error: iError } = await supabase
      .from('invoices')
      .insert({
        company_id: budget.company_id,
        client_id: budget.client_id,
        budget_id: budget.id,
        total_amount: budget.total_amount,
        status: 'draft',
        afip_comprobante_tipo: cbteTipo,
        invoice_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single()

    if (iError) {
      console.error('Error creating invoice:', iError)
      return NextResponse.json({ success: false, error: 'Error al crear borrador de factura' }, { status: 500 })
    }

    // 3. Crear los ítems de la factura (Snapshot)
    const itemsToInsert = budget.budget_items.map((item: any) => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_code: item.product_code,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total
    }))

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsToInsert)

    if (itemsError) {
      console.error('Error creating invoice items:', itemsError)
      return NextResponse.json({ success: false, error: 'Error al copiar ítems a la factura' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      invoice_id: invoice.id 
    })

  } catch (error: any) {
    console.error('Error in create-draft:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
