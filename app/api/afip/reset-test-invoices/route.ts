import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabaseAdmin = createSupabaseAdminClient()

    // 1. Autenticar usuario obligatoriamente
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      userId = user?.id || null
    }

    if (!userId) {
      const { data: { user } } = await supabaseAdmin.auth.getUser()
      userId = user?.id || null
    }

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Obtener perfil del usuario autenticado
    const { data: profile } = await supabaseAdmin
      .from('users_profiles')
      .select('company_id, role')
      .eq('id', userId)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Perfil o empresa no encontrada' }, { status: 403 })
    }

    const companyId = profile.company_id

    // 3. Obtener todas las facturas borrador o de prueba de la empresa
    const { data: companyInvoices } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .eq('company_id', companyId)

    const invoiceIds = (companyInvoices || []).map(i => i.id)

    // 4. Eliminar ítems de factura asociados
    if (invoiceIds.length > 0) {
      await supabaseAdmin
        .from('invoice_items')
        .delete()
        .in('invoice_id', invoiceIds)
    }

    // 5. Eliminar registros de facturas de la empresa
    await supabaseAdmin
      .from('invoices')
      .delete()
      .eq('company_id', companyId)

    // 6. Limpiar datos de CAE en presupuestos de la empresa
    await supabaseAdmin
      .from('budgets')
      .update({
        afip_cae: null,
        afip_cae_vencimiento: null,
        afip_comprobante_numero: null,
        afip_comprobante_tipo: null
      })
      .eq('company_id', companyId)

    // 7. Forzar paso a Producción Real (is_sandbox = false) y limpiar certificados
    const { data: currentAfipConfig } = await supabaseAdmin
      .from('afip_configs')
      .select('cert_content')
      .eq('company_id', companyId)
      .maybeSingle()

    if (currentAfipConfig) {
      const cleanCert = currentAfipConfig.cert_content?.split('===WSAA_TICKET===')[0].trim() || ''
      await supabaseAdmin
        .from('afip_configs')
        .update({
          is_sandbox: false,
          cert_content: cleanCert
        })
        .eq('company_id', companyId)
    }

    return NextResponse.json({
      success: true,
      message: 'Se liberaron los presupuestos y se configuró el entorno en Producción Real correctamente.'
    })
  } catch (error: any) {
    console.error('Error al resetear facturas:', error)
    return NextResponse.json({ error: error.message || 'Error al resetear' }, { status: 500 })
  }
}
