import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
const Afip = require('afip-apis')
// Si la librería exporta un default, lo usamos, si no, usamos el objeto directamente
const { WSAA, WSFE } = Afip.default || Afip 
import fs from 'fs'
import path from 'path'
import os from 'os'

export async function POST(request: Request) {
  const tempDir = os.tmpdir()
  const certPath = path.join(tempDir, `cert_${Date.now()}.crt`)
  const keyPath = path.join(tempDir, `key_${Date.now()}.key`)

  try {
    const body = await request.json()
    const { company_id } = body
    console.log('Probando conexión para company_id:', company_id)

    if (!company_id) {
      return NextResponse.json({ error: 'Falta company_id' }, { status: 400 })
    }

    // 1. Obtener config con el cliente Admin para saltar RLS en el servidor
    const supabaseAdmin = createSupabaseAdminClient()
    const { data: config, error: dbError } = await supabaseAdmin
      .from('afip_configs')
      .select('*')
      .eq('company_id', company_id)
      .single()

    if (dbError) {
      console.error('Error al buscar configuración en DB:', dbError)
      return NextResponse.json({ error: 'Configuración fiscal no encontrada en DB' }, { status: 404 })
    }

    if (!config) {
      console.error('Config es null para company_id:', company_id)
      return NextResponse.json({ error: 'Configuración fiscal vacía' }, { status: 404 })
    }

    // 2. Crear archivos temporales para los certificados (AFIP pide archivos físicos para firmar)
    fs.writeFileSync(certPath, config.cert_content)
    fs.writeFileSync(keyPath, config.key_content)

    // 3. Inicializar WSAA (Autenticación)
    const wsaa = new WSAA({
      certPath,
      keyPath,
      env: config.is_sandbox ? 'dev' : 'prod'
    })

    // 4. Inicializar WSFE (Facturación Electrónica)
    const wsfe = new WSFE(wsaa, {
      env: config.is_sandbox ? 'dev' : 'prod'
    })

    // 5. Probar estado del servidor
    const status = await wsfe.getServerStatus()

    return NextResponse.json({
      success: true,
      status,
      message: 'Conexión con ARCA exitosa (WSFE)'
    })

  } catch (error: any) {
    console.error('Error AFIP:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al conectar con AFIP. Verificá tus certificados.'
    }, { status: 500 })
  } finally {
    // Limpiar archivos temporales
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath)
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath)
  }
}
