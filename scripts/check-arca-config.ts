import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// Cargar variables de entorno desde .env.local o .env usando fs nativo
function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=')
        const val = rest.join('=').trim().replace(/^["']|["']$/g, '')
        if (key && !process.env[key.trim()]) {
          process.env[key.trim()] = val
        }
      }
    })
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'))
loadEnvFile(path.resolve(process.cwd(), '.env'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('[DIAGNÓSTICO ARCA] Error: Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRole)

interface ArcaDiagnosticResult {
  company_id: string
  entorno: 'homo' | 'prod'
  certificado_presente: boolean
  clave_presente: boolean
  credenciales_corruptas: boolean
  punto_venta: number
  sha256_cert_fragment: string
}

function calculateCertFingerprintFragment(pem: string): string {
  if (!pem || !pem.includes('BEGIN CERTIFICATE')) return 'N/A'
  try {
    const cleanPem = pem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '')
    const certBuffer = Buffer.from(cleanPem, 'base64')
    const hash = crypto.createHash('sha256').update(certBuffer).digest('hex')
    return hash.substring(0, 12)
  } catch {
    return 'INVALID_PEM'
  }
}

async function runDiagnostic() {
  console.log('====================================================')
  console.log('     DIAGNÓSTICO SEGURO DE CONFIGURACIÓN ARCA      ')
  console.log('====================================================')

  // 1. Revisar configuración existente en afip_configs
  const { data: configs, error: afipErr } = await supabase
    .from('afip_configs')
    .select('company_id, cuit, punto_venta, is_sandbox, cert_content, key_content')

  if (afipErr) {
    console.error('Error al consultar afip_configs:', afipErr.message)
    return
  }

  // 2. Revisar configuración en arca_credentials (si existe la tabla)
  const { data: newCreds, error: arcaErr } = await supabase
    .from('arca_credentials')
    .select('company_id, environment, cuit, punto_venta, certificate_fingerprint, verified_at')

  if (arcaErr) {
    console.warn('Nota: arca_credentials aún no existe o no tiene datos:', arcaErr.message)
  }

  const results: ArcaDiagnosticResult[] = []
  let hasCorruptCredentials = false

  if (configs && configs.length > 0) {
    for (const c of configs) {
      const certRaw = c.cert_content || ''
      const keyRaw = c.key_content || ''

      const isPlaceholderCert = certRaw.includes('CERTIFICADO CONFIGURADO')
      const isPlaceholderKey = keyRaw.includes('CLAVE PRIVADA CONFIGURADA')

      const hasValidCert = certRaw.includes('BEGIN CERTIFICATE') && !isPlaceholderCert
      const hasValidKey = (keyRaw.includes('BEGIN PRIVATE KEY') || keyRaw.includes('BEGIN RSA PRIVATE KEY')) && !isPlaceholderKey

      const isCorrupt = isPlaceholderCert || isPlaceholderKey || 
        (Boolean(certRaw) && !hasValidCert) || 
        (Boolean(keyRaw) && !hasValidKey)

      if (isCorrupt) {
        hasCorruptCredentials = true
      }

      results.push({
        company_id: c.company_id,
        entorno: c.is_sandbox ? 'homo' : 'prod',
        certificado_presente: hasValidCert,
        clave_presente: hasValidKey,
        credenciales_corruptas: isCorrupt,
        punto_venta: Number(c.punto_venta) || 0,
        sha256_cert_fragment: hasValidCert ? calculateCertFingerprintFragment(certRaw) : 'N/A'
      })
    }
  }

  console.log('\n--- Estado en afip_configs (Legacy) ---')
  if (results.length === 0) {
    console.log('No se encontraron registros en afip_configs.')
  } else {
    console.table(results)
  }

  if (newCreds && newCreds.length > 0) {
    console.log('\n--- Estado en arca_credentials (Nuevo esquema) ---')
    console.table(
      newCreds.map(cr => ({
        company_id: cr.company_id,
        entorno: cr.environment,
        cuit: cr.cuit,
        punto_venta: cr.punto_venta,
        fingerprint_fragment: (cr.certificate_fingerprint || '').substring(0, 12),
        verified_at: cr.verified_at || 'No validado'
      }))
    )
  }

  if (hasCorruptCredentials) {
    console.error('\n[ALERTA CRÍTICA] Se detectaron placeholders o credenciales corruptas guardadas en la base de datos.')
    console.error('DEBE restaurar los archivos PEM originales (.crt y .key) antes de continuar.')
  } else {
    console.log('\n[OK] Diagnóstico completado sin secretos expuestos.')
  }
}

runDiagnostic().catch(err => {
  console.error('Error no controlado durante el diagnóstico:', err)
  process.exit(1)
})
