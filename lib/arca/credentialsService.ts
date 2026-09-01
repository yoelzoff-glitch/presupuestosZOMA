import { SupabaseClient } from '@supabase/supabase-js'
import { encryptText, decryptText, getCertificateFingerprint, EncryptedPayload } from './encryption'

export interface ArcaCredentialsRecord {
  id: string
  companyId: string
  environment: 'homo' | 'prod'
  cuit: string
  puntoVenta: number
  tipoContribuyente: 'monotributo' | 'responsable_inscripto' | 'exento'
  certificatePem: string
  privateKeyPem: string
  certificateFingerprint: string
  verifiedAt: string | null
}

export interface ArcaCredentialsMetadata {
  configured: boolean
  environment: 'homo' | 'prod'
  cuit: string
  punto_venta: number
  tipo_contribuyente: string
  certificate_configured: boolean
  key_configured: boolean
  certificate_fingerprint?: string
  verified_at: string | null
}

/**
 * Obtiene los metadatos de configuración fiscal para un entorno específico sin exponer secretos.
 */
export async function getArcaCredentialsMetadata(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  environment: 'homo' | 'prod'
): Promise<ArcaCredentialsMetadata> {
  const { data, error } = await supabaseAdmin
    .from('arca_credentials')
    .select('cuit, punto_venta, tipo_contribuyente, certificate_fingerprint, verified_at, certificate_payload, private_key_payload')
    .eq('company_id', companyId)
    .eq('environment', environment)
    .maybeSingle()

  if (error || !data) {
    // Si no existe en el nuevo esquema, verificar si hay configuración en afip_configs legacy
    if (environment === 'homo') {
      const { data: legacy } = await supabaseAdmin
        .from('afip_configs')
        .select('cuit, punto_venta, tipo_contribuyente, is_sandbox, cert_content, key_content, updated_at')
        .eq('company_id', companyId)
        .maybeSingle()

      if (legacy && legacy.is_sandbox) {
        const hasCert = Boolean(legacy.cert_content && legacy.cert_content.includes('BEGIN CERTIFICATE') && !legacy.cert_content.includes('CERTIFICADO CONFIGURADO'))
        const hasKey = Boolean(legacy.key_content && (legacy.key_content.includes('BEGIN PRIVATE KEY') || legacy.key_content.includes('BEGIN RSA PRIVATE KEY')) && !legacy.key_content.includes('CLAVE PRIVADA CONFIGURADA'))

        return {
          configured: hasCert && hasKey && Boolean(legacy.cuit),
          environment: 'homo',
          cuit: legacy.cuit || '',
          punto_venta: Number(legacy.punto_venta) || 0,
          tipo_contribuyente: legacy.tipo_contribuyente || 'monotributo',
          certificate_configured: hasCert,
          key_configured: hasKey,
          verified_at: null
        }
      }
    }

    return {
      configured: false,
      environment,
      cuit: '',
      punto_venta: 0,
      tipo_contribuyente: 'monotributo',
      certificate_configured: false,
      key_configured: false,
      verified_at: null
    }
  }

  const hasCert = Boolean(data.certificate_payload && (data.certificate_payload as EncryptedPayload).ciphertext)
  const hasKey = Boolean(data.private_key_payload && (data.private_key_payload as EncryptedPayload).ciphertext)

  return {
    configured: hasCert && hasKey && Boolean(data.cuit) && Number(data.punto_venta) > 0,
    environment,
    cuit: data.cuit || '',
    punto_venta: Number(data.punto_venta) || 0,
    tipo_contribuyente: data.tipo_contribuyente || 'monotributo',
    certificate_configured: hasCert,
    key_configured: hasKey,
    certificate_fingerprint: data.certificate_fingerprint || undefined,
    verified_at: data.verified_at || null
  }
}

/**
 * Obtiene y descifra las credenciales completas para un entorno en memoria del servidor.
 * NUNCA exponer el resultado al cliente.
 */
export async function getDecryptedArcaCredentials(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  environment: 'homo' | 'prod'
): Promise<ArcaCredentialsRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('arca_credentials')
    .select('*')
    .eq('company_id', companyId)
    .eq('environment', environment)
    .maybeSingle()

  if (error) {
    throw new Error(`Error al consultar credenciales ARCA: ${error.message}`)
  }

  if (data) {
    const certPayload = data.certificate_payload as EncryptedPayload
    const keyPayload = data.private_key_payload as EncryptedPayload

    const certPem = decryptText(certPayload)
    const keyPem = decryptText(keyPayload)

    if (!certPem || !keyPem) {
      throw new Error(`No se pudieron descifrar las credenciales de ${environment.toUpperCase()} para la empresa.`)
    }

    return {
      id: data.id,
      companyId: data.company_id,
      environment: data.environment,
      cuit: data.cuit,
      puntoVenta: Number(data.punto_venta),
      tipoContribuyente: data.tipo_contribuyente,
      certificatePem: certPem,
      privateKeyPem: keyPem,
      certificateFingerprint: data.certificate_fingerprint,
      verifiedAt: data.verified_at
    }
  }

  // Fallback temporal de lectura únicamente si es homo y existe en afip_configs legacy
  if (environment === 'homo') {
    const { data: legacy } = await supabaseAdmin
      .from('afip_configs')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    if (legacy && legacy.cert_content && legacy.key_content && legacy.is_sandbox) {
      const cleanCert = legacy.cert_content.split('===WSAA_TICKET')[0].trim()
      const cleanKey = legacy.key_content.split('===WSAA_TICKET')[0].replace(/\r\n/g, '\n').trim()

      if (cleanCert.includes('BEGIN CERTIFICATE') && (cleanKey.includes('BEGIN PRIVATE KEY') || cleanKey.includes('BEGIN RSA PRIVATE KEY'))) {
        return {
          id: legacy.id || companyId,
          companyId,
          environment: 'homo',
          cuit: legacy.cuit.replace(/-/g, '').trim(),
          puntoVenta: Number(legacy.punto_venta),
          tipoContribuyente: legacy.tipo_contribuyente,
          certificatePem: cleanCert,
          privateKeyPem: cleanKey,
          certificateFingerprint: getCertificateFingerprint(cleanCert),
          verifiedAt: null
        }
      }
    }
  }

  return null
}

/**
 * Guarda o actualiza credenciales cifrándolas con AES-256-GCM en arca_credentials.
 */
export async function saveArcaCredentials(
  supabaseAdmin: SupabaseClient,
  params: {
    companyId: string
    environment: 'homo' | 'prod'
    cuit: string
    puntoVenta: number
    tipoContribuyente: 'monotributo' | 'responsable_inscripto' | 'exento'
    certPem?: string
    keyPem?: string
  }
): Promise<{ success: boolean; fingerprint?: string }> {
  const { companyId, environment, cuit, puntoVenta, tipoContribuyente, certPem, keyPem } = params

  const { data: existing } = await supabaseAdmin
    .from('arca_credentials')
    .select('certificate_payload, private_key_payload, certificate_fingerprint')
    .eq('company_id', companyId)
    .eq('environment', environment)
    .maybeSingle()

  let certPayload: EncryptedPayload
  let keyPayload: EncryptedPayload
  let fingerprint: string

  if (certPem && keyPem) {
    certPayload = encryptText(certPem.trim())
    keyPayload = encryptText(keyPem.trim())
    fingerprint = getCertificateFingerprint(certPem)
  } else if (existing?.certificate_payload && existing?.private_key_payload) {
    certPayload = existing.certificate_payload
    keyPayload = existing.private_key_payload
    fingerprint = existing.certificate_fingerprint
  } else {
    throw new Error('Debe proveer un certificado (.crt) y clave privada (.key) válidos para configurar el entorno.')
  }

  const { error } = await supabaseAdmin
    .from('arca_credentials')
    .upsert({
      company_id: companyId,
      environment,
      cuit,
      punto_venta: puntoVenta,
      tipo_contribuyente: tipoContribuyente,
      certificate_payload: certPayload,
      private_key_payload: keyPayload,
      certificate_fingerprint: fingerprint,
      verified_at: null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'company_id, environment' })

  if (error) {
    throw new Error(`Error al persistir credenciales cifradas: ${error.message}`)
  }

  return { success: true, fingerprint }
}
