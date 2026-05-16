import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Arca } from '@arcasdk/core'
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

    if (!company_id) {
      return NextResponse.json({ error: 'Falta company_id' }, { status: 400 })
    }

    // 1. Obtener config con el cliente Admin
    const supabaseAdmin = createSupabaseAdminClient()
    const { data: config, error: dbError } = await supabaseAdmin
      .from('afip_configs')
      .select('*')
      .eq('company_id', company_id)
      .single()

    if (dbError || !config) {
      return NextResponse.json({ error: 'Configuración fiscal no encontrada' }, { status: 404 })
    }

    // 2. Crear archivos temporales
    fs.writeFileSync(certPath, config.cert_content)
    fs.writeFileSync(keyPath, config.key_content)

    // 3. Inicializar ARCA SDK
    const arca = new Arca({
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8'),
      cuit: parseInt(config.cuit.replace(/-/g, '')),
      production: !config.is_sandbox
    })

    // 4. Probar estado del servidor WSFE
    const status = await arca.electronicBillingService.getServerStatus()

    return NextResponse.json({
      success: true,
      status,
      message: 'Conexión exitosa con ARCA (WSFE)'
    })

  } catch (error: any) {
    console.error('Error ARCA SDK:', error)
    
    // Si el error es que ya estamos autenticados, ¡es un éxito!
    if (error.message?.includes('alreadyAuthenticated') || error.message?.includes('CEE ya posee un TA valido')) {
      return NextResponse.json({
        success: true,
        status: { appserver: 'OK', dbserver: 'OK', authserver: 'OK' }, // Simulamos OK ya que el TA es válido
        message: 'Conexión activa y válida con ARCA'
      })
    }

    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error al conectar con ARCA' 
    }, { status: 500 })
  } finally {
    // Limpiar
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath)
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath)
  }
}
