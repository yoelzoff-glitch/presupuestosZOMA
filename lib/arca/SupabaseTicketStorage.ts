import { ITicketStoragePort } from '@arcasdk/core/lib/infrastructure/outbound/ports/storage/ticket-storage.port'
import { AccessTicket } from '@arcasdk/core/lib/domain/entities/access-ticket.entity'
import { SupabaseClient } from '@supabase/supabase-js'
import { encryptText, decryptText, EncryptedPayload } from './encryption'

export interface SupabaseTicketStorageConfig {
  supabaseAdmin: SupabaseClient
  companyId: string
  cuit: string
  environment: 'homo' | 'prod'
}

// Mapa de bloqueos en memoria por instancia para evitar solicitudes concurrentes simultáneas al WSAA
const activeWsaaRequests = new Map<string, Promise<AccessTicket | null>>()

export class SupabaseTicketStorage implements ITicketStoragePort {
  private supabaseAdmin: SupabaseClient
  private companyId: string
  private cuit: string
  private environment: 'homo' | 'prod'

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
   * Guarda el ticket de acceso WSAA cifrado con AES-256-GCM en la tabla arca_wsaa_tickets
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
  }

  /**
   * Obtiene un ticket WSAA válido para el servicio.
   * Exige al menos 5 minutos (300.000 ms) de vigencia restante.
   */
  async get(serviceName: string): Promise<AccessTicket | null> {
    try {
      const { data, error } = await this.supabaseAdmin
        .from('arca_wsaa_tickets')
        .select('encrypted_payload, expires_at')
        .eq('company_id', this.companyId)
        .eq('cuit', this.cuit)
        .eq('environment', this.environment)
        .eq('service', serviceName)
        .maybeSingle()

      if (error || !data || !data.encrypted_payload) {
        return null
      }

      // Verificar vigencia temporal en DB antes de descifrar
      const expiresAt = new Date(data.expires_at).getTime()
      const now = Date.now()
      const fiveMinutesMs = 5 * 60 * 1000

      if (expiresAt - now < fiveMinutesMs) {
        return null
      }

      const payload = data.encrypted_payload as EncryptedPayload
      const decryptedJson = decryptText(payload)
      if (!decryptedJson) {
        return null
      }

      const ticketData = JSON.parse(decryptedJson)
      if (ticketData?.header && ticketData?.credentials) {
        const ticket = AccessTicket.create(ticketData)
        
        // Validar entidad con regla estricta de 5 minutos
        if (ticket.isValid() && ticket.getTimeUntilExpiration() > fiveMinutesMs) {
          return ticket
        }
      }
    } catch {
      // Si falla lectura o descifrado, retornar null para que el SDK solicite uno nuevo
    }

    return null
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
      console.warn(`Error al eliminar ticket WSAA: ${error.message}`)
    }
  }

  /**
   * Wrapper para ejecutar llamadas concurrentes de obtención/solicitud de ticket
   */
  async acquireWithLock(serviceName: string, requestFn: () => Promise<AccessTicket>): Promise<AccessTicket> {
    const existing = await this.get(serviceName)
    if (existing) return existing

    const lockKey = this.getLockKey(serviceName)
    if (activeWsaaRequests.has(lockKey)) {
      const ticket = await activeWsaaRequests.get(lockKey)
      if (ticket) return ticket
    }

    const requestPromise = (async () => {
      try {
        const newTicket = await requestFn()
        await this.save(newTicket, serviceName)
        return newTicket
      } finally {
        activeWsaaRequests.delete(lockKey)
      }
    })()

    activeWsaaRequests.set(lockKey, requestPromise)
    return requestPromise
  }
}
