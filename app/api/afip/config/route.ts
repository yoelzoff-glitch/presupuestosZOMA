import { NextResponse } from 'next/server'
import { requireCompanyUser } from '@/lib/auth/requireCompanyUser'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { UpdateFiscalConfigSchema } from '@/lib/arca/validations'
import { getArcaCredentialsMetadata, saveArcaCredentials } from '@/lib/arca/credentialsService'

export async function GET(request: Request) {
  const auth = await requireCompanyUser({ allowedRoles: ['admin', 'super_admin'] })
  if (!auth.success) return auth.response

  const { companyId } = auth.user
  const supabaseAdmin = createSupabaseAdminClient()

  const url = new URL(request.url)
  const envParam = url.searchParams.get('environment')
  const requestedEnv: 'homo' | 'prod' = envParam === 'prod' ? 'prod' : 'homo'

  const [homoMeta, prodMeta] = await Promise.all([
    getArcaCredentialsMetadata(supabaseAdmin, companyId, 'homo'),
    getArcaCredentialsMetadata(supabaseAdmin, companyId, 'prod')
  ])

  const currentMeta = requestedEnv === 'prod' ? prodMeta : homoMeta

  return NextResponse.json({
    configured: currentMeta.configured,
    environment: requestedEnv,
    cuit: currentMeta.cuit,
    punto_venta: currentMeta.punto_venta,
    tipo_contribuyente: currentMeta.tipo_contribuyente,
    certificate_configured: currentMeta.certificate_configured,
    key_configured: currentMeta.key_configured,
    certificate_fingerprint: currentMeta.certificate_fingerprint,
    verified_at: currentMeta.verified_at,
    // Estado comparativo para UI
    environments: {
      homo: homoMeta,
      prod: prodMeta
    }
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

  const { cuit, tipo_contribuyente, punto_venta, environment, cert_content, key_content } = validation.data
  const supabaseAdmin = createSupabaseAdminClient()

  try {
    const result = await saveArcaCredentials(supabaseAdmin, {
      companyId,
      environment,
      cuit,
      puntoVenta: punto_venta,
      tipoContribuyente: tipo_contribuyente,
      certPem: cert_content,
      keyPem: key_content
    })

    return NextResponse.json({
      success: true,
      environment,
      certificate_fingerprint: result.fingerprint,
      message: `Configuración fiscal para ${environment === 'prod' ? 'Producción' : 'Homologación'} guardada y cifrada con éxito.`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al guardar credenciales' }, { status: 500 })
  }
}
