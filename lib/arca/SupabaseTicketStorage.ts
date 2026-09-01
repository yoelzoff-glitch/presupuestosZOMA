import { ITicketStoragePort } from '@arcasdk/core/lib/infrastructure/outbound/ports/storage/ticket-storage.port'
import { AccessTicket } from '@arcasdk/core/lib/domain/entities/access-ticket.entity'
import { SupabaseClient } from '@supabase/supabase-js'
import { encryptText, decryptText, EncryptedPayload } from './encryption'
import crypto from 'crypto'

export interface SupabaseTicketStorageConfig {
  supabaseAdmin: SupabaseClient
  companyId: string
  cuit: string
  environment: 'homo' | 'prod'
}

export class SupabaseTicketStorage implements ITicketStoragePort {
  private supabaseAdmin: SupabaseClient
  private companyId: string
  private cuit: string
  private environment: 'homo' | 'prod'
  private activeLockTokens = new Map<string, string>()

  constructor(config: SupabaseTicketStorageConfig) {
    this.supabaseAdmin = config.supabaseAdmin
    this.companyId = config.companyId
    this.cuit = config.cuit.replace(/-/g, '').trim()
    this.environment = config.environment
  }

  private getLockKey(serviceName: string): string {
    return `${this.companyId}:${this.cuit}:${this.environment}:${serviceName}`
  }

  /**
   * Intenta adquirir el lock distribuido en PostgreSQL para solicitar ticket WSAA
   */
  async acquireWsaaLock(serviceName: string, leaseSeconds = 60): Promise<{ acquired: boolean; token: string }> {
    const lockKey = this.getLockKey(serviceName)
    const token = crypto.randomUUID()

    const { data, error } = await this.supabaseAdmin.rpc('claim_arca_wsaa_lock', {
      p_lock_key: lockKey,
      p_lock_token: token,
      p_lease_seconds: leaseSeconds
    })

    if (error) {
      throw new Error(`Error al adquirir lock distribuido WSAA: ${error.message}`)
    }

    const acquired = Boolean(data)
    if (acquired) {
      this.activeLockTokens.set(serviceName, token)
    }

    return { acquired, token }
  }

  /**
   * Libera el lock distribuido WSAA
   */
  async releaseWsaaLock(serviceName: string, token?: string): Promise<void> {
    const lockKey = this.getLockKey(serviceName)
    const lockToken = token || this.activeLockTokens.get(serviceName)

    if (!lockToken) return

    this.activeLockTokens.delete(serviceName)
    try {
      await this.supabaseAdmin.rpc('release_arca_wsaa_lock', {
        p_lock_key: lockKey,
        p_lock_token: lockToken
      })
    } catch {
      // Ignorar fallo de release si ya expiró
    }
  }

  /**
   * Guarda el ticket de acceso WSAA cifrado con AES-256-GCM en la tabla arca_wsaa_tickets
   * y libera cualquier lock activo para este servicio.
   */
  async save(ticket: AccessTicket, serviceName: string): Promise<void> {
    const ticketData = {
      header: ticket.getHeaders(),
      credentials: ticket.getCredentials(),
    }

    const plainJson = JSON.stringify(ticketData)
    const encryptedPayload = encryptText(plainJson)
    const expirationDate = ticket.getExpiration()

    const { error } = await this.supabaseAdmin
      .from('arca_wsaa_tickets')
      .upsert({
        company_id: this.companyId,
        cuit: this.cuit,
        environment: this.environment,
        service: serviceName,
        encrypted_payload: encryptedPayload,
        expires_at: expirationDate.toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'company_id, cuit, environment, service' })

    if (error) {
      throw new Error(`Error crítico al persistir ticket WSAA en Supabase: ${error.message}`)
    }

    // Liberar lock tras persistir
    await this.releaseWsaaLock(serviceName)
  }

  /**
   * Consulta directa y descifrado seguro de un ticket existente en la base de datos
   */
  private async fetchPersistedTicket(serviceName: string): Promise<AccessTicket | null> {
    const { data, error } = await this.supabaseAdmin
      .from('arca_wsaa_tickets')
      .select('encrypted_payload, expires_at')
      .eq('company_id', this.companyId)
      .eq('cuit', this.cuit)
      .eq('environment', this.environment)
      .eq('service', serviceName)
      .maybeSingle()

    if (error) {
      throw new Error(`Error de base de datos al consultar ticket WSAA: ${error.message}`)
    }

    if (!data || !data.encrypted_payload) {
      return null
    }

    const expiresAt = new Date(data.expires_at).getTime()
    const now = Date.now()
    const fiveMinutesMs = 5 * 60 * 1000

    if (expiresAt - now < fiveMinutesMs) {
      return null
    }

    const payload = data.encrypted_payload as EncryptedPayload
    let decryptedJson: string | null = null
    try {
      decryptedJson = decryptText(payload)
    } catch (decryptErr: unknown) {
      throw new Error(`Error al descifrar ticket WSAA existente: ${decryptErr instanceof Error ? decryptErr.message : 'Falla de integridad criptográfica'}`)
    }

    if (!decryptedJson) {
      throw new Error('El contenido del ticket WSAA descifrado está vacío')
    }

    let ticketData: { header?: unknown; credentials?: { token?: string; sign?: string } }
    try {
      ticketData = JSON.parse(decryptedJson)
    } catch (parseErr: unknown) {
      throw new Error(`Formato JSON inválido en ticket WSAA: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`)
    }

    if (ticketData?.header && ticketData?.credentials) {
      const ticket = AccessTicket.create(ticketData as Parameters<typeof AccessTicket.create>[0])
      if (ticket.isValid() && ticket.getTimeUntilExpiration() > fiveMinutesMs) {
        return ticket
      }
    }

    return null
  }

  /**
   * Obtiene un ticket WSAA válido para el servicio integrando el lock distribuido:
   * 1. Si existe un ticket válido, lo devuelve inmediatamente.
   * 2. Si no existe:
   *    - Si esta instancia ya adquirió el lock, devuelve null (para que el SDK solicite login).
   *    - Si adquiere el lock, devuelve null (procederá a solicitar el login).
   *    - Si otra instancia tiene el lock, entra en polling esperando a que la otra instancia guarde el ticket.
   */
  async get(serviceName: string): Promise<AccessTicket | null> {
    // 1. Verificar si ya existe un ticket válido
    const existingTicket = await this.fetchPersistedTicket(serviceName)
    if (existingTicket) {
      return existingTicket
    }

    // 2. Si esta instancia ya posee el lock activo para este servicio, evitar deadlock
    if (this.activeLockTokens.has(serviceName)) {
      return null
    }

    // 3. Intentar adquirir el lock distribuido en PostgreSQL
    const { acquired } = await this.acquireWsaaLock(serviceName, 60)
    if (acquired) {
      // Esta instancia ejecutará el login WSAA
      return null
    }

    // 4. Otra instancia está solicitando el ticket WSAA -> Polling con jitter limitado
    const maxWaitMs = 10000
    const pollIntervalMs = 500
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      const jitter = Math.floor(Math.random() * 200)
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs + jitter))

      const polledTicket = await this.fetchPersistedTicket(serviceName)
      if (polledTicket) {
        return polledTicket
      }
    }

    // 5. Si terminó el tiempo de espera sin ticket persistido, reintentar adquirir el lock
    const retryLock = await this.acquireWsaaLock(serviceName, 60)
    if (retryLock.acquired) {
      return null
    }

    // Si no se pudo adquirir el lock ni se encontró ticket en base de datos: error temporal
    throw new Error(`Timeout esperando ticket de autenticación WSAA para el servicio ${serviceName}. Concurrencia alta o fallo en worker emisor.`)
  }

  /**
   * Elimina el ticket WSAA almacenado para el servicio
   */
  async delete(serviceName: string): Promise<void> {
    const { error } = await this.supabaseAdmin
      .from('arca_wsaa_tickets')
      .delete()
      .eq('company_id', this.companyId)
      .eq('cuit', this.cuit)
      .eq('environment', this.environment)
      .eq('service', serviceName)

    if (error) {
      throw new Error(`Error al eliminar ticket WSAA: ${error.message}`)
    }
  }
}
