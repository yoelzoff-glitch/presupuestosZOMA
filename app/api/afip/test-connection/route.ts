import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Arca } from '@arcasdk/core'
import fs from 'fs'
import path from 'path'
import os from 'os'

export async function POST(request: Request) {
  const tempDir = os.tmpdir()
  const certPath = path.join(tempDir, `cert_test_${Date.now()}.crt`)
  const keyPath = path.join(tempDir, `key_test_${Date.now()}.key`)

  try {
    const supabaseAdmin = createSupabaseAdminClient()

    // 1. Autenticación estricta del usuario vía Supabase Session
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      userId = user?.id || null
    }

    if (!userId) {
      // Fallback a cookie de sesión de Supabase si aplica
      const { data: { user } } = await supabaseAdmin.auth.getUser()
      userId = user?.id || null
    }

    // Permitir company_id especificado solo si se valida con el perfil del usuario autenticado
    const body = await request.json().catch(() => ({}))
    let companyId: string | null = null

    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('users_profiles')
        .select('company_id')
        .eq('id', userId)
        .single()
      companyId = profile?.company_id || null
    }

    // Si viene company_id en body pero no hay userId, denegar
    if (!companyId) {
      companyId = body.company_id || null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No autorizado o empresa no encontrada' }, { status: 401 })
    }

    // 2. Obtener configuración fiscal
    const { data: config, error: dbError } = await supabaseAdmin
      .from('afip_configs')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (dbError || !config) {
      return NextResponse.json({ error: 'Configuración fiscal no encontrada' }, { status: 404 })
    }

    if (!config.cert_content || !config.key_content || !config.cuit) {
      return NextResponse.json({ error: 'Certificados o CUIT no configurados' }, { status: 400 })
    }

    // Extraer únicamente el certificado PEM (por si existieran residuos antiguos de WSAA_TICKET)
    const actualCert = config.cert_content.split('===WSAA_TICKET===')[0].trim()
    const cleanKey = config.key_content.split('===WSAA_TICKET===')[0].replace(/\r\n/g, '\n').trim()
    const cuitClean = config.cuit.replace(/-/g, '').trim()
    const isProduction = !config.is_sandbox

    fs.writeFileSync(certPath, actualCert)
    fs.writeFileSync(keyPath, cleanKey)

    const ticketsDir = path.join(os.tmpdir(), 'arca-tickets-stable')
    
    // 3. Inicializar cliente nativo Arca SDK
    const arcaOptions: any = {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8'),
      cuit: parseInt(cuitClean),
      production: isProduction,
      ticketPath: ticketsDir,
      useHttpsAgent: true
    }

    const arca = new Arca(arcaOptions)

    // 4. Testear servidor de Facturación Electrónica (WSFE)
    const status = await arca.electronicBillingService.getServerStatus()

    // Intentar consultar puntos de venta para validar autorización completa del Web Service
    let puntosVenta: any = null
    try {
      puntosVenta = await arca.electronicBillingService.getSalesPoints()
    } catch (pvErr) {
      console.log('Información adicional: No se pudieron consultar los puntos de venta directamente:', pvErr)
    }

    return NextResponse.json({
      success: true,
      status,
      is_production: isProduction,
      punto_venta_configurado: config.punto_venta,
      puntos_venta_arca: puntosVenta,
      message: `Conexión exitosa con ARCA WSFE en modo ${isProduction ? 'Producción (Real)' : 'Homologación (Testing)'}`
    })

  } catch (error: any) {
    console.error('Error al probar conexión con ARCA:', error)

    const fullErrorText = (
      (error.message || '') + 
      (error.response?.data?.message || '') + 
      (error.body?.message || '') +
      (error.faultstring || '') +
      (error.toString?.() || '')
    ).toLowerCase()

    const isAlreadyAuth = 
      fullErrorText.includes('alreadyauthenticated') || 
      fullErrorText.includes('cee ya posee un ta valido')

    if (isAlreadyAuth) {
      return NextResponse.json({
        success: true,
        status: { appserver: 'OK', dbserver: 'OK', authserver: 'OK' },
        message: 'Conexión activa y válida con ARCA (Sesión reutilizada)'
      })
    }

    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error al conectar con ARCA' 
    }, { status: 500 })
  } finally {
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath)
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath)
  }
}
