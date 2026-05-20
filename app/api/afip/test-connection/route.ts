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

    // Split certificate content to separate the actual cert from cached ticket
    const certParts = config.cert_content.split('===WSAA_TICKET===')
    const actualCert = certParts[0].trim()
    const cachedTicketStr = certParts[1]?.trim()

    let cachedTicket: any = null
    if (cachedTicketStr) {
      try {
        cachedTicket = JSON.parse(cachedTicketStr)
      } catch (e) {
        console.error('Error parsing cached ticket:', e)
      }
    }

    const now = Date.now()
    const isTicketValid = cachedTicket && cachedTicket.expiresAt && cachedTicket.expiresAt > now + 60000

    // 2. Crear archivos temporales
    fs.writeFileSync(certPath, actualCert)
    fs.writeFileSync(keyPath, config.key_content.split('===WSAA_TICKET===')[0].trim())

    // 3. Inicializar ARCA SDK
    const arcaOptions: any = {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8'),
      cuit: parseInt(config.cuit.replace(/-/g, '')),
      production: !config.is_sandbox,
      useHttpsAgent: true,
    }

    if (isTicketValid) {
      arcaOptions.credentials = cachedTicket.credentials
      arcaOptions.handleTicket = true
    } else {
      arcaOptions.ticketPath = path.join(os.tmpdir(), 'arca-tickets-stable')
    }

    const arca = new Arca(arcaOptions)

    // 4. Probar estado del servidor WSFE
    const status = await arca.electronicBillingService.getServerStatus()

    // Si no teníamos un ticket válido en DB y se creó uno nuevo en disco, guardarlo en la DB
    if (!isTicketValid) {
      const cuitClean = config.cuit.replace(/-/g, '')
      const ticketFileName = `TA-${cuitClean}-wsfe.json`
      const ticketFilePath = path.join(os.tmpdir(), 'arca-tickets-stable', ticketFileName)
      
      if (fs.existsSync(ticketFilePath)) {
        try {
          const ticketContent = fs.readFileSync(ticketFilePath, 'utf8')
          const ticketData = JSON.parse(ticketContent)
          const expirationStr = ticketData.header?.[1]?.expirationtime
          if (expirationStr) {
            const expiresAt = new Date(expirationStr).getTime()
            const payload = {
              credentials: {
                header: ticketData.header,
                credentials: ticketData.credentials
              },
              expiresAt
            }
            const updatedCertContent = `${actualCert}\n===WSAA_TICKET===\n${JSON.stringify(payload)}`
            await supabaseAdmin
              .from('afip_configs')
              .update({ cert_content: updatedCertContent })
              .eq('company_id', company_id)
            console.log('Successfully cached WSAA ticket in database from test-connection.')
          }
        } catch (err) {
          console.error('Failed to cache ticket in database from test-connection:', err)
        }
      }
    }

    return NextResponse.json({
      success: true,
      status,
      message: 'Conexión exitosa con ARCA (WSFE)'
    })

  } catch (error: any) {
    console.error('Error ARCA SDK:', error)
    
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
    // Limpiar
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath)
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath)
  }
}
