import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { user_id, company_id: requestCompanyId } = await request.json().catch(() => ({}))
    const supabaseAdmin = createSupabaseAdminClient()

    let companyId = requestCompanyId

    if (!companyId && user_id) {
      const { data: profile } = await supabaseAdmin
        .from('users_profiles')
        .select('company_id')
        .eq('id', user_id)
        .single()
      companyId = profile?.company_id
    }

    if (!companyId) {
      // Intentar obtener la empresa del CUIT 20412886128
      const { data: afipConfig } = await supabaseAdmin
        .from('afip_configs')
        .select('company_id')
        .eq('cuit', '20412886128')
        .maybeSingle()
      companyId = afipConfig?.company_id
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No se identificó la empresa' }, { status: 400 })
    }

    // 1. Obtener todas las facturas de la empresa
    const { data: companyInvoices } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .eq('company_id', companyId)

    const invoiceIds = (companyInvoices || []).map(i => i.id)

    // 2. Eliminar ítems de factura
    if (invoiceIds.length > 0) {
      await supabaseAdmin
        .from('invoice_items')
        .delete()
        .in('invoice_id', invoiceIds)
    }

    // 3. Eliminar facturas de la empresa
    await supabaseAdmin
      .from('invoices')
      .delete()
      .eq('company_id', companyId)

    // 4. Limpiar datos de CAE en presupuestos de la empresa
    await supabaseAdmin
      .from('budgets')
      .update({
        afip_cae: null,
        afip_cae_vencimiento: null,
        afip_comprobante_numero: null,
        afip_comprobante_tipo: null
      })
      .eq('company_id', companyId)

    return NextResponse.json({
      success: true,
      message: 'Se resetearon y eliminaron todas las facturas de prueba de Sandbox correctamente.'
    })
  } catch (error: any) {
    console.error('Error al resetear facturas:', error)
    return NextResponse.json({ error: error.message || 'Error al resetear' }, { status: 500 })
  }
}
