import { NextResponse } from 'next/server'
import { createSupabaseAdminClient, getServerUserContext } from '@/lib/supabase/server'
import { Arca } from '@arcasdk/core'
import { SupabaseTicketStorage } from '@/lib/afip/supabase-ticket-storage'
import fs from 'fs'
import path from 'path'
import os from 'os'

export async function POST(request: Request) {
  const tempDir = os.tmpdir()
  const certPath = path.join(tempDir, `cert_test_${Date.now()}.crt`)
  const keyPath = path.join(tempDir, `key_test_${Date.now()}.key`)

  try {
    const supabaseAdmin = createSupabaseAdminClient()

    // 1. Autenticación robusta de sesión (Cookies SSR / Bearer token)
    let companyId: string | null = null

    // Intento 1: Sesión por Cookies (SSR Next.js)
    const userContext = await getServerUserContext()
    if (userContext?.idEmpresa) {
      companyId = userContext.idEmpresa
    }

    // Intento 2: Header Authorization Bearer
    if (!companyId) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '').trim()
        const { data: { user } } = await supabaseAdmin.auth.getUser(token)
        if (user) {
          const { data: profile } = await supabaseAdmin
            .from('users_profiles')
            .select('company_id')
            .eq('id', user.id)
            .single()
          companyId = profile?.company_id || null
        }
      }
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión para continuar.' }, { status: 401 })
    }

    // 2. Obtener configuración fiscal de la empresa
    const { data: config, error: dbError } = await supabaseAdmin
      .from('afip_configs')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (dbError || !config) {
      return NextResponse.json({ error: 'Configuración fiscal no encontrada para su empresa' }, { status: 404 })
    }

    if (!config.cert_content || !config.key_content || !config.cuit) {
      return NextResponse.json({ error: 'Certificados (.crt), clave (.key) o CUIT no configurados.' }, { status: 400 })
    }

    if (!config.punto_venta || Number(config.punto_venta) <= 0) {
      return NextResponse.json({ error: 'Debe configurar un Punto de Venta válido mayor a 0.' }, { status: 400 })
    }

    // 3. Extraer certificado PEM y clave privada
    const cleanCert = config.cert_content.split('===WSAA_TICKET')[0].trim()
    const cleanKey = config.key_content.split('===WSAA_TICKET')[0].replace(/\r\n/g, '\n').trim()
    const cuitClean = config.cuit.replace(/-/g, '').trim()
    const isProduction = !config.is_sandbox
    const ptoVtaBuscado = Number(config.punto_venta)

    fs.writeFileSync(certPath, cleanCert)
    fs.writeFileSync(keyPath, cleanKey)

    // 4. Inicializar almacenamiento persistente de tickets WSAA
    const ticketStorage = new SupabaseTicketStorage({
      supabaseAdmin,
      companyId,
      cuit: cuitClean,
      production: isProduction
    })

    const arca = new Arca({
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8'),
      cuit: parseInt(cuitClean),
      production: isProduction,
      ticketStorage,
      useHttpsAgent: true
    })

    // 5. Testear servidor de Facturación Electrónica (WSFE)
    const serverStatus = await arca.electronicBillingService.getServerStatus()

    const statusAny = serverStatus as any
    const appOk = statusAny.appServer === 'OK' || statusAny.appserver === 'OK' || statusAny.AppServer === 'OK'
    const dbOk = statusAny.dbServer === 'OK' || statusAny.dbserver === 'OK' || statusAny.DbServer === 'OK'
    const authOk = statusAny.authServer === 'OK' || statusAny.authserver === 'OK' || statusAny.AuthServer === 'OK'

    if (!appOk || !dbOk || !authOk) {
      return NextResponse.json({
        success: false,
        status: serverStatus,
        error: `Servidores de ARCA con demoras (App: ${statusAny.appServer || statusAny.appserver}, DB: ${statusAny.dbServer || statusAny.dbserver}, Auth: ${statusAny.authServer || statusAny.authserver})`
      }, { status: 502 })
    }

    // 6. Validar Puntos de Venta reales dados de alta en ARCA
    let puntosVenta: any = null
    let puntoVentaEncontrado = false

    try {
      puntosVenta = await arca.electronicBillingService.getSalesPoints()
      
      const listaPuntos = Array.isArray(puntosVenta) 
        ? puntosVenta 
        : (puntosVenta?.ResultGet?.PtoVenta || puntosVenta?.PtoVenta || [])

      if (Array.isArray(listaPuntos) && listaPuntos.length > 0) {
        puntoVentaEncontrado = listaPuntos.some((pv: any) => {
          const num = Number(pv.Nro || pv.nro || pv.PtoVta || pv)
          const bloqueado = pv.Bloqueado === 'S' || pv.bloqueado === 'S'
          return num === ptoVtaBuscado && !bloqueado
        })
      } else {
        puntoVentaEncontrado = true // Si no devuelve array estructurado, permitir
      }
    } catch (pvErr: any) {
      console.warn('No se pudo validar el listado de puntos de venta con ARCA:', pvErr)
      throw new Error(`Error al consultar Puntos de Venta en ARCA: ${pvErr.message || 'Verifique delegación del servicio wsfe'}`)
    }

    if (!puntoVentaEncontrado && Array.isArray(puntosVenta) && puntosVenta.length > 0) {
      return NextResponse.json({
        success: false,
        error: `El Punto de Venta ${ptoVtaBuscado} no está habilitado en ARCA para este CUIT en modo ${isProduction ? 'Producción' : 'Testing'}. Verifique Puntos de Venta en AFIP.`
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      status: serverStatus,
      is_production: isProduction,
      punto_venta: ptoVtaBuscado,
      message: `Conexión exitosa y validada con ARCA WSFE (${isProduction ? 'Producción Oficial' : 'Modo Testing'})`
    })

  } catch (error: any) {
    console.error('Error al probar conexión con ARCA:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error al conectar con ARCA' 
    }, { status: 500 })
  } finally {
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath)
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath)
  }
}
