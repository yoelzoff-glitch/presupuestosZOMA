import { ITicketStoragePort } from '@arcasdk/core/lib/infrastructure/outbound/ports/storage/ticket-storage.port'
import { AccessTicket } from '@arcasdk/core/lib/domain/entities/access-ticket.entity'
import { SupabaseClient } from '@supabase/supabase-js'
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
    return `===WSAA_TICKET_${this.production ? 'PROD' : 'HOMO'}===`
  }

  async save(ticket: AccessTicket, serviceName: string): Promise<void> {
    const ticketData = {
      header: ticket.getHeaders(),
      credentials: ticket.getCredentials(),
    }

    // 1. Guardar en disco local L1
    try {
      if (!fs.existsSync(this.ticketDiskPath)) {
        fs.mkdirSync(this.ticketDiskPath, { recursive: true })
      }
      fs.writeFileSync(this.getDiskFilePath(serviceName), JSON.stringify(ticketData, null, 2), 'utf8')
    } catch (e) {
      console.warn('Advertencia: No se pudo guardar ticket en disco local:', e)
    }

    // 2. Guardar en base de datos Supabase L2 (Persistente entre instancias serverless)
    try {
      const { data: config } = await this.supabaseAdmin
        .from('afip_configs')
        .select('cert_content')
        .eq('company_id', this.companyId)
        .single()

      if (config?.cert_content) {
        // Extraer únicamente el certificado base PEM limpio
        const cleanCert = config.cert_content.split('===WSAA_TICKET')[0].trim()
        const delimiter = this.getDelimiter()
        const updatedCertContent = `${cleanCert}\n${delimiter}\n${JSON.stringify(ticketData)}`

        await this.supabaseAdmin
          .from('afip_configs')
          .update({ cert_content: updatedCertContent })
          .eq('company_id', this.companyId)
      }
    } catch (e) {
      console.error('Error guardando ticket en Supabase:', e)
    }
  }

  async get(serviceName: string): Promise<AccessTicket | null> {
    // 1. Intentar leer desde disco local L1
    try {
      const diskPath = this.getDiskFilePath(serviceName)
      if (fs.existsSync(diskPath)) {
        const fileContent = fs.readFileSync(diskPath, 'utf8')
        const ticketData = JSON.parse(fileContent)
        const ticket = AccessTicket.create(ticketData)
        if (ticket.isValid()) {
          return ticket
        }
      }
    } catch (e) {
      // Continuar a L2
    }

    // 2. Leer desde Supabase L2
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
          const ticketJsonStr = parts[1]?.split('===WSAA_TICKET')[0]?.trim()
          if (ticketJsonStr) {
            const ticketData = JSON.parse(ticketJsonStr)
            const ticket = AccessTicket.create(ticketData)
            if (ticket.isValid()) {
              // Sincronizar hacia L1 local para próximos accesos rápidos
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
    } catch (e) {
      console.error('Error recuperando ticket desde Supabase:', e)
    }

    return null
  }

  async delete(serviceName: string): Promise<void> {
    // 1. Eliminar de disco local
    try {
      const diskPath = this.getDiskFilePath(serviceName)
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath)
      }
    } catch (e) {}

    // 2. Limpiar de Supabase
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
