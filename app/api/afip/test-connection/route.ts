import { NextResponse } from 'next/server'
import { requireCompanyUser } from '@/lib/auth/requireCompanyUser'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { createArcaClient } from '@/lib/arca/arcaClient'
import { SalesPoint } from '@arcasdk/core/lib/domain/types/electronic-billing.types'

export async function POST(request: Request) {
  try {
    // 1. Autenticación robusta y verificación de rol admin
    const auth = await requireCompanyUser({ allowedRoles: ['admin', 'super_admin'] })
    if (!auth.success) return auth.response

    const { companyId } = auth.user
    const supabaseAdmin = createSupabaseAdminClient()

    const body = await request.json().catch(() => ({}))
    const requestedEnv: 'homo' | 'prod' = body.environment === 'prod' ? 'prod' : 'homo'

    // 2. Cargar exclusivamente las credenciales del entorno solicitado
    const { arca, credentials, isProduction } = await createArcaClient(
      supabaseAdmin,
      companyId,
      requestedEnv
    )

    const ptoVtaBuscado = credentials.puntoVenta

    // 3. Testear estado de los servidores de Facturación Electrónica (WSFE)
    const serverStatus = await arca.electronicBillingService.getServerStatus()

    const appOk = serverStatus?.appServer === 'OK'
    const dbOk = serverStatus?.dbServer === 'OK'
    const authOk = serverStatus?.authServer === 'OK'

    if (!appOk || !dbOk || !authOk) {
      return NextResponse.json({
        success: false,
        environment: requestedEnv,
        error: `Servidores de ARCA no disponibles (App: ${serverStatus?.appServer || 'FAIL'}, DB: ${serverStatus?.dbServer || 'FAIL'}, Auth: ${serverStatus?.authServer || 'FAIL'})`
      }, { status: 502 })
    }

    // 4. Validar Puntos de Venta reales usando el DTO de @arcasdk/core 1.3.1
    const puntosVentaResponse = await arca.electronicBillingService.getSalesPoints()

    if (puntosVentaResponse.errors?.err && puntosVentaResponse.errors.err.length > 0) {
      const errorDetail = puntosVentaResponse.errors.err.map(e => `[${e.code}] ${e.msg}`).join(', ')
      return NextResponse.json({
        success: false,
        environment: requestedEnv,
        error: `Error retornado por ARCA al consultar Puntos de Venta: ${errorDetail}`
      }, { status: 400 })
    }

    const listaPuntos: SalesPoint[] = puntosVentaResponse.resultGet?.ptoVenta ?? []

    if (listaPuntos.length === 0) {
      return NextResponse.json({
        success: false,
        environment: requestedEnv,
        error: `ARCA no devolvió ningún Punto de Venta activo para el CUIT ${credentials.cuit} en entorno ${isProduction ? 'Producción' : 'Homologación'}. Verifique la delegación del servicio wsfe en la web de ARCA/AFIP.`
      }, { status: 400 })
    }

    const puntoEncontrado = listaPuntos.find(pv => Number(pv.nro) === ptoVtaBuscado)

    if (!puntoEncontrado) {
      const disponibles = listaPuntos.map(p => p.nro).join(', ')
      return NextResponse.json({
        success: false,
        environment: requestedEnv,
        error: `El Punto de Venta ${ptoVtaBuscado} no existe en ARCA para este CUIT en ${isProduction ? 'Producción' : 'Homologación'}. Puntos de venta habilitados en ARCA: [${disponibles || 'ninguno'}].`
      }, { status: 400 })
    }

    if (puntoEncontrado.bloqueado === 'S') {
      return NextResponse.json({
        success: false,
        environment: requestedEnv,
        error: `El Punto de Venta ${ptoVtaBuscado} se encuentra BLOQUEADO en ARCA.`
      }, { status: 400 })
    }

    // 5. Actualizar verified_at en arca_credentials
    const nowIso = new Date().toISOString()
    await supabaseAdmin
      .from('arca_credentials')
      .update({ verified_at: nowIso, updated_at: nowIso })
      .eq('company_id', companyId)
      .eq('environment', requestedEnv)

    return NextResponse.json({
      success: true,
      environment: requestedEnv,
      cuit: credentials.cuit,
      punto_venta: ptoVtaBuscado,
      punto_venta_validado: true,
      certificate_fingerprint: credentials.certificateFingerprint,
      verified_at: nowIso,
      message: `Credenciales y punto de venta validados con éxito en ARCA ${isProduction ? 'Producción' : 'Homologación'}.`
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al conectar con ARCA'
    }, { status: 500 })
  }
}
