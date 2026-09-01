import { Arca } from '@arcasdk/core'
import { SupabaseClient } from '@supabase/supabase-js'
import { getDecryptedArcaCredentials, ArcaCredentialsRecord } from './credentialsService'
import { SupabaseTicketStorage } from './SupabaseTicketStorage'

export interface InitializedArcaContext {
  arca: Arca
  credentials: ArcaCredentialsRecord
  ticketStorage: SupabaseTicketStorage
  isProduction: boolean
}

/**
 * Inicializa de forma segura una instancia del SDK de ARCA con las credenciales
 * específicas para el entorno solicitado (homo o prod).
 * 
 * Reglas de seguridad estrictas:
 * - PROHIBIDO reutilizar automáticamente certificados de HOMO en PROD.
 * - PROHIBIDO hacer fallback de PROD hacia HOMO.
 * - Si faltan credenciales del entorno elegido, bloquea la ejecución con un error explícito.
 */
export async function createArcaClient(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  environment: 'homo' | 'prod'
): Promise<InitializedArcaContext> {
  const credentials = await getDecryptedArcaCredentials(supabaseAdmin, companyId, environment)

  if (!credentials) {
    throw new Error(
      `No se encontraron credenciales fiscales configuradas para el entorno ${environment === 'prod' ? 'PRODUCCIÓN (Real)' : 'HOMOLOGACIÓN (Testing)'}. Configure y valide los certificados en Configuración Fiscal.`
    )
  }

  if (!credentials.certificatePem || !credentials.privateKeyPem) {
    throw new Error(
      `Credenciales incompletas para ${environment.toUpperCase()}: Falta el certificado (.crt) o la clave privada (.key).`
    )
  }

  if (!credentials.cuit || credentials.cuit.length !== 11) {
    throw new Error(`CUIT inválido o no configurado para ${environment.toUpperCase()}: debe tener 11 dígitos.`)
  }

  if (!credentials.puntoVenta || credentials.puntoVenta <= 0) {
    throw new Error(`Punto de Venta inválido para ${environment.toUpperCase()}: debe ser un número entero mayor a 0.`)
  }

  const isProduction = environment === 'prod'

  const ticketStorage = new SupabaseTicketStorage({
    supabaseAdmin,
    companyId,
    cuit: credentials.cuit,
    environment
  })

  const arca = new Arca({
    key: credentials.privateKeyPem,
    cert: credentials.certificatePem,
    cuit: parseInt(credentials.cuit, 10),
    production: isProduction,
    ticketStorage,
    useHttpsAgent: true
  })

  return {
    arca,
    credentials,
    ticketStorage,
    isProduction
  }
}
