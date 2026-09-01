import { ITicketStoragePort } from '@arcasdk/core/lib/infrastructure/outbound/ports/storage/ticket-storage.port'
import { AccessTicket } from '@arcasdk/core/lib/domain/entities/access-ticket.entity'
import { SupabaseClient } from '@supabase/supabase-js'
import { encryptText, decryptText, EncryptedPayload } from './encryption'
import fs from 'fs'
import path from 'path'
import os from 'os'

export interface SupabaseTicketStorageConfig {
  supabaseAdmin: SupabaseClient
  companyId: string
  cuit: string
  production: boolean
}

export class SupabaseTicketStorage implements ITicketStoragePort {
  private supabaseAdmin: SupabaseClient
  private companyId: string
  private cuit: string
  private production: boolean
  private ticketDiskPath: string

  constructor(config: SupabaseTicketStorageConfig) {
    this.supabaseAdmin = config.supabaseAdmin
    this.companyId = config.companyId
    this.cuit = config.cuit.replace(/-/g, '').trim()
    this.production = config.production
    this.ticketDiskPath = path.join(os.tmpdir(), 'arca-tickets-stable')
  }

  private getDiskFilePath(serviceName: string): string {
    const filename = `TA-${this.cuit}-${serviceName}${this.production ? '-production' : ''}.json`
    return path.join(this.ticketDiskPath, filename)
  }

  private getDelimiter(): string {
    return `===WSAA_TICKET_SECURE_${this.production ? 'PROD' : 'HOMO'}===`
  }

  async save(ticket: AccessTicket, serviceName: string): Promise<void> {
    const ticketData = {
      header: ticket.getHeaders(),
      credentials: ticket.getCredentials(),
    }

    // 1. Guardar en memoria/disco local L1 para rapidez dentro del mismo worker
    try {
      if (!fs.existsSync(this.ticketDiskPath)) {
        fs.mkdirSync(this.ticketDiskPath, { recursive: true })
      }
      fs.writeFileSync(this.getDiskFilePath(serviceName), JSON.stringify(ticketData, null, 2), 'utf8')
    } catch (e) {
      console.warn('No se pudo guardar ticket en disco local temporal:', e)
    }

    // 2. Cifrar con AES-256-GCM y persistir en Supabase L2 para compartir entre cold starts de Vercel
    try {
      const plainJson = JSON.stringify(ticketData)
      const encrypted = encryptText(plainJson)
      const payloadString = JSON.stringify(encrypted)

      const { data: config } = await this.supabaseAdmin
        .from('afip_configs')
        .select('cert_content')
        .eq('company_id', this.companyId)
        .single()

      if (config?.cert_content) {
        // Extraer únicamente el certificado PEM original sin metadatos de tickets anteriores
        const cleanCert = config.cert_content.split('===WSAA_TICKET')[0].trim()
        const delimiter = this.getDelimiter()
        const updatedCertContent = `${cleanCert}\n${delimiter}\n${payloadString}`

        await this.supabaseAdmin
          .from('afip_configs')
          .update({ cert_content: updatedCertContent })
          .eq('company_id', this.companyId)
      }
    } catch (e) {
      console.error('Error persistiendo ticket cifrado en Supabase:', e)
    }
  }

  async get(serviceName: string): Promise<AccessTicket | null> {
    // 1. Intentar recuperar de disco local L1
    try {
      const diskPath = this.getDiskFilePath(serviceName)
      if (fs.existsSync(diskPath)) {
        const fileContent = fs.readFileSync(diskPath, 'utf8')
        const ticketData = JSON.parse(fileContent)
        const ticket = AccessTicket.create(ticketData)
        // Requerir al menos 5 minutos de vigencia restante
        if (ticket.isValid() && ticket.getTimeUntilExpiration() > 5 * 60 * 1000) {
          return ticket
        }
      }
    } catch (e) {
      // Continuar a L2
    }

    // 2. Recuperar de Supabase L2 y descifrar en memoria
    try {
      const { data: config } = await this.supabaseAdmin
        .from('afip_configs')
        .select('cert_content')
        .eq('company_id', this.companyId)
        .single()

      if (config?.cert_content) {
        const delimiter = this.getDelimiter()
        if (config.cert_content.includes(delimiter)) {
          const parts = config.cert_content.split(delimiter)
          const encryptedStr = parts[1]?.split('===WSAA_TICKET')[0]?.trim()
          if (encryptedStr) {
            let ticketData: any = null
            try {
              // Intentar descifrado AES-256-GCM
              const payload: EncryptedPayload = JSON.parse(encryptedStr)
              const decryptedJson = decryptText(payload)
              if (decryptedJson) {
                ticketData = JSON.parse(decryptedJson)
              }
            } catch (pErr) {
              // Fallback si es formato JSON plano previo
              ticketData = JSON.parse(encryptedStr)
            }

            if (ticketData?.header && ticketData?.credentials) {
              const ticket = AccessTicket.create(ticketData)
              if (ticket.isValid() && ticket.getTimeUntilExpiration() > 5 * 60 * 1000) {
                // Sincronizar hacia L1 local para próximos accesos
                try {
                  if (!fs.existsSync(this.ticketDiskPath)) {
                    fs.mkdirSync(this.ticketDiskPath, { recursive: true })
                  }
                  fs.writeFileSync(this.getDiskFilePath(serviceName), JSON.stringify(ticketData, null, 2), 'utf8')
                } catch (e) {}
                return ticket
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Error recuperando ticket cifrado de Supabase:', e)
    }

    return null
  }

  async delete(serviceName: string): Promise<void> {
    try {
      const diskPath = this.getDiskFilePath(serviceName)
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath)
      }
    } catch (e) {}

    try {
      const { data: config } = await this.supabaseAdmin
        .from('afip_configs')
        .select('cert_content')
        .eq('company_id', this.companyId)
        .single()

      if (config?.cert_content) {
        const cleanCert = config.cert_content.split('===WSAA_TICKET')[0].trim()
        await this.supabaseAdmin
          .from('afip_configs')
          .update({ cert_content: cleanCert })
          .eq('company_id', this.companyId)
      }
    } catch (e) {}
  }
}
