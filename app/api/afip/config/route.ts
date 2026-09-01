import { NextResponse } from 'next/server'
import { requireCompanyUser } from '@/lib/auth/requireCompanyUser'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { UpdateFiscalConfigSchema } from '@/lib/arca/validations'

export async function GET() {
  const auth = await requireCompanyUser({ allowedRoles: ['admin', 'super_admin'] })
  if (!auth.success) return auth.response

  const { companyId } = auth.user
  const supabaseAdmin = createSupabaseAdminClient()

  const { data: config, error } = await supabaseAdmin
    .from('afip_configs')
    .select('cuit, punto_venta, tipo_contribuyente, is_sandbox, cert_content, key_content, updated_at')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const hasCert = Boolean(config?.cert_content && config.cert_content.includes('BEGIN CERTIFICATE'))
  const hasKey = Boolean(config?.key_content && (config.key_content.includes('BEGIN PRIVATE KEY') || config.key_content.includes('BEGIN RSA PRIVATE KEY')))

  return NextResponse.json({
    configured: Boolean(config && hasCert && hasKey),
    cuit: config?.cuit || '',
    punto_venta: config?.punto_venta || 0,
    tipo_contribuyente: config?.tipo_contribuyente || 'monotributo',
    is_sandbox: config?.is_sandbox ?? true,
    certificate_configured: hasCert,
    key_configured: hasKey,
    updated_at: config?.updated_at || null
  })
}

export async function PUT(request: Request) {
  const auth = await requireCompanyUser({ allowedRoles: ['admin', 'super_admin'] })
  if (!auth.success) return auth.response

  const { companyId } = auth.user
  const body = await request.json().catch(() => ({}))

  const validation = UpdateFiscalConfigSchema.safeParse(body)
  if (!validation.success) {
    const errorMsg = validation.error.issues.map(i => i.message).join(', ')
    return NextResponse.json({ error: errorMsg }, { status: 400 })
  }

  const { cuit, tipo_contribuyente, punto_venta, cert_content, key_content, is_sandbox } = validation.data
  const supabaseAdmin = createSupabaseAdminClient()

  // Extraer únicamente el certificado PEM limpio
  const cleanCert = cert_content.split('===WSAA_TICKET')[0].trim()
  const cleanKey = key_content.split('===WSAA_TICKET')[0].trim()

  const payload = {
    company_id: companyId,
    cuit: cuit.replace(/-/g, '').trim(),
    tipo_contribuyente,
    punto_venta,
    cert_content: cleanCert,
    key_content: cleanKey,
    is_sandbox,
    updated_at: new Date()
  }

  const { error } = await supabaseAdmin
    .from('afip_configs')
    .upsert(payload, { onConflict: 'company_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: 'Configuración fiscal guardada y cifrada correctamente en el servidor.'
  })
}
