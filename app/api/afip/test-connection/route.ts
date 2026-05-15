import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
const { WSAA, WSFE } = require('afip-apis')
import fs from 'fs'
import path from 'path'
import os from 'os'

export async function POST(request: Request) {
  const tempDir = os.tmpdir()
  const certPath = path.join(tempDir, `cert_${Date.now()}.crt`)
  const keyPath = path.join(tempDir, `key_${Date.now()}.key`)

  try {
    const { company_id } = await request.json()

    if (!company_id) {
      return NextResponse.json({ error: 'Falta company_id' }, { status: 400 })
    }

    // 1. Obtener config
    const { data: config, error } = await supabase
      .from('afip_configs')
      .select('*')
      .eq('company_id', company_id)
      .single()

    if (error || !config) {
      return NextResponse.json({ error: 'Configuración fiscal no encontrada' }, { status: 404 })
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
