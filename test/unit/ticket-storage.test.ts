import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SupabaseTicketStorage } from '@/lib/arca/SupabaseTicketStorage'
import { AccessTicket } from '@arcasdk/core/lib/domain/entities/access-ticket.entity'
import { ILoginCmsReturnHeaders } from '@arcasdk/core/lib/infrastructure/outbound/ports/soap/interfaces/LoginCMSService/LoginCms'
import { TEST_ENCRYPTION_KEY_BASE64 } from '../helpers/crypto-fixtures'

interface TicketDbRecord {
  company_id: string
  cuit: string
  environment: string
  service: string
  encrypted_payload: { iv: string; ciphertext: string; tag: string }
  expires_at: string
}

describe('Unit Tests: SupabaseTicketStorage', () => {
  const originalEnv = process.env.ARCA_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ARCA_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY_BASE64
  })

  afterEach(() => {
    process.env.ARCA_ENCRYPTION_KEY = originalEnv
  })

  function createMockAccessTicket(expiresInMinutes: number): AccessTicket {
    const now = new Date()
    const exp = new Date(now.getTime() + expiresInMinutes * 60 * 1000)

    const headers: ILoginCmsReturnHeaders = [
      { version: '1.0' },
      {
        source: 'CN=wsaahomo',
        destination: 'CN=mytest',
        uniqueid: '12345',
        generationtime: now.toISOString(),
        expirationtime: exp.toISOString()
      }
    ]

    return AccessTicket.create({
      header: headers,
      credentials: {
        token: 'mock-token-sample',
        sign: 'mock-sign-sample'
      }
    })
  }

  it('Unit 8 & 9: Tickets HOMO y PROD y de diferentes servicios no se mezclan', async () => {
    // Mock in-memory database table for arca_wsaa_tickets
    const ticketsDb = new Map<string, TicketDbRecord>()

    const createMockSupabase = () => ({
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      from: (_tableName: string) => ({
        upsert: vi.fn().mockImplementation(async (record: TicketDbRecord) => {
          const key = `${record.company_id}:${record.cuit}:${record.environment}:${record.service}`
          ticketsDb.set(key, record)
          return { error: null }
        }),
        select: vi.fn().mockImplementation(() => {
          const filter = { companyId: '', cuit: '', env: '', service: '' }
          const builder = {
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === 'company_id') filter.companyId = val
              if (col === 'cuit') filter.cuit = val
              if (col === 'environment') filter.env = val
              if (col === 'service') filter.service = val
              return builder
            }),
            maybeSingle: vi.fn().mockImplementation(async () => {
              const key = `${filter.companyId}:${filter.cuit}:${filter.env}:${filter.service}`
              const data = ticketsDb.get(key)
              return { data: data || null, error: null }
            })
          }
          return builder
        }),
        delete: vi.fn().mockImplementation(() => {
          const filter = { companyId: '', cuit: '', env: '', service: '' }
          const builder = {
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === 'company_id') filter.companyId = val
              if (col === 'cuit') filter.cuit = val
              if (col === 'environment') filter.env = val
              if (col === 'service') filter.service = val
              return builder
            }),
            then: vi.fn().mockImplementation((resolve: (value: { error: null }) => void) => {
              const key = `${filter.companyId}:${filter.cuit}:${filter.env}:${filter.service}`
              ticketsDb.delete(key)
              resolve({ error: null })
            })
          }
          return builder
        })
      })
    })

    const supabaseMock = createMockSupabase() as unknown as ConstructorParameters<typeof SupabaseTicketStorage>[0]['supabaseAdmin']

    const storageHomoWsfe = new SupabaseTicketStorage({
      supabaseAdmin: supabaseMock,
      companyId: 'company-123',
      cuit: '20123456789',
      environment: 'homo'
    })

    const storageProdWsfe = new SupabaseTicketStorage({
      supabaseAdmin: supabaseMock,
      companyId: 'company-123',
      cuit: '20123456789',
      environment: 'prod'
    })

    const storageHomoWsfex = new SupabaseTicketStorage({
      supabaseAdmin: supabaseMock,
      companyId: 'company-123',
      cuit: '20123456789',
      environment: 'homo'
    })

    // Guardar ticket en HOMO para WSFE
    const ticketHomo = createMockAccessTicket(60)
    await storageHomoWsfe.save(ticketHomo, 'wsfe')

    // Verificar que PROD para WSFE no encuentra el ticket de HOMO
    const prodWsfeTicket = await storageProdWsfe.get('wsfe')
    expect(prodWsfeTicket).toBeNull()

    // Verificar que HOMO para WSFEX no encuentra el ticket de WSFE
    const homoWsfexTicket = await storageHomoWsfex.get('wsfex')
    expect(homoWsfexTicket).toBeNull()

    // Verificar que HOMO para WSFE sí recupera su ticket
    const homoWsfeTicket = await storageHomoWsfe.get('wsfe')
    expect(homoWsfeTicket).not.toBeNull()
    expect(homoWsfeTicket?.getCredentials().token).toBe('mock-token-sample')
  })

  it('Unit 10: Un ticket con menos de 5 minutos de vigencia se considera vencido', async () => {
    // Ticket con 3 minutos de vigencia (menos de 5 minutos requeridos)
    const expiringTicket = createMockAccessTicket(3)

    let storedRecord: TicketDbRecord | null = null
    const supabaseMock = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      from: () => ({
        upsert: async (record: TicketDbRecord) => { storedRecord = record; return { error: null } },
        select: () => {
          const builder = {
            eq: () => builder,
            maybeSingle: async () => ({ data: storedRecord, error: null })
          }
          return builder
        }
      })
    } as unknown as ConstructorParameters<typeof SupabaseTicketStorage>[0]['supabaseAdmin']

    const storage = new SupabaseTicketStorage({
      supabaseAdmin: supabaseMock,
      companyId: 'company-123',
      cuit: '20123456789',
      environment: 'homo'
    })

    await storage.save(expiringTicket, 'wsfe')

    // Al consultar, debe descartarlo por tener menos de 5 minutos restantes
    const retrieved = await storage.get('wsfe')
    expect(retrieved).toBeNull()

    // Ticket con 30 minutos de vigencia sí es aceptado
    const validTicket = createMockAccessTicket(30)
    await storage.save(validTicket, 'wsfe')
    const validRetrieved = await storage.get('wsfe')
    expect(validRetrieved).not.toBeNull()
  })
})
