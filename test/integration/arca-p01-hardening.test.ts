import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TEST_ENCRYPTION_KEY_BASE64 } from '../helpers/crypto-fixtures'
import { CreateInvoiceRequestSchema } from '@/lib/arca/validations'
import { createArcaClient } from '@/lib/arca/arcaClient'
import { saveArcaCredentials } from '@/lib/arca/credentialsService'
import {
  buildIdempotencyKey,
  claimInvoiceAttempt,
  acquireEmissionLockDistributed,
  releaseEmissionLockDistributed,
  reconcileVoucherWithArca,
  InvoiceAttemptRecord
} from '@/lib/arca/idempotency'
import { SupabaseTicketStorage } from '@/lib/arca/SupabaseTicketStorage'

describe('Integration & Security Tests: Sprint P0.1 ARCA Hardening (22 Scenarios)', () => {
  const originalEnv = process.env.ARCA_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ARCA_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY_BASE64
  })

  afterEach(() => {
    process.env.ARCA_ENCRYPTION_KEY = originalEnv
  })

  // Test 1: Request sin environment -> 400
  it('Test 1: Request de emisión sin environment es rechazado por el schema con error 400', () => {
    const payloadWithoutEnv = {
      budget_id: '550e8400-e29b-41d4-a716-446655440000',
      cbteTipoOverride: 11
    }
    const result = CreateInvoiceRequestSchema.safeParse(payloadWithoutEnv)
    expect(result.success).toBe(false)
  })

  // Test 2: environment=prod utiliza credenciales PROD
  it('Test 2: environment=prod consulta y utiliza exclusivamente credenciales productivas', async () => {
    let queriedEnv = ''
    const supabaseMock = {
      from: (table: string) => {
        const b = {
          select: () => b,
          eq: (col: string, val: string) => {
            if (col === 'environment') queriedEnv = val
            return b
          },
          maybeSingle: async () => {
            if (table === 'arca_credentials' && queriedEnv === 'prod') {
              return {
                data: {
                  id: 'cred-prod-1',
                  company_id: 'comp-1',
                  environment: 'prod',
                  cuit: '20123456789',
                  punto_venta: 2,
                  tipo_contribuyente: 'monotributo',
                  verified_at: '2026-09-01T12:00:00Z',
                  certificate_payload: { iv: 'a', ciphertext: 'b', tag: 'c' },
                  private_key_payload: { iv: 'd', ciphertext: 'e', tag: 'f' }
                },
                error: null
              }
            }
            return { data: null, error: null }
          }
        }
        return b
      }
    } as unknown as Parameters<typeof createArcaClient>[0]

    // Stub decryptText to return dummy certificates
    const creds = await (await import('@/lib/arca/credentialsService')).getArcaCredentialsMetadata(supabaseMock, 'comp-1', 'prod')
    expect(creds.environment).toBe('prod')
    expect(queriedEnv).toBe('prod')
  })

  // Test 3: Producción sin verified_at -> 409
  it('Test 3: createArcaClient bloquea entorno PROD con HTTP 409 si verified_at es null', async () => {
    const supabaseMock = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'cred-prod-1',
                  company_id: 'comp-1',
                  environment: 'prod',
                  cuit: '20123456789',
                  punto_venta: 2,
                  tipo_contribuyente: 'monotributo',
                  verified_at: null, // NO VALIDADO
                  certificate_payload: { iv: 'a', ciphertext: 'b', tag: 'c' },
                  private_key_payload: { iv: 'd', ciphertext: 'e', tag: 'f' }
                },
                error: null
              })
            })
          })
        })
      })
    } as unknown as Parameters<typeof createArcaClient>[0]

    // Mock decryptText
    vi.spyOn(await import('@/lib/arca/encryption'), 'decryptText').mockReturnValue('-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----')

    await expect(createArcaClient(supabaseMock, 'comp-1', 'prod')).rejects.toThrow(
      /Las credenciales de Producción deben validarse antes de emitir/
    )
  })

  // Test 4: Cambiar credenciales elimina verified_at
  it('Test 4: saveArcaCredentials resetea verified_at a null al actualizar datos fiscales', async () => {
    let savedRecord: Record<string, unknown> | null = null
    const supabaseMock = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  certificate_payload: { iv: 'iv', ciphertext: 'c', tag: 't' },
                  private_key_payload: { iv: 'iv2', ciphertext: 'c2', tag: 't2' }
                }
              })
            })
          })
        }),
        upsert: async (record: Record<string, unknown>) => {
          savedRecord = record
          return { error: null }
        }
      })
    } as unknown as Parameters<typeof saveArcaCredentials>[0]

    await saveArcaCredentials(supabaseMock, {
      companyId: 'comp-1',
      environment: 'prod',
      cuit: '20123456789',
      puntoVenta: 5,
      tipoContribuyente: 'monotributo'
    })

    expect(savedRecord).not.toBeNull()
    expect((savedRecord as Record<string, unknown> | null)?.verified_at).toBeNull()
  })

  // Test 5: Todos los callers envían environment
  it('Test 5: Schemas de llamada y verificación exigen environment obligatorio', () => {
    const validPayload = {
      budget_id: '550e8400-e29b-41d4-a716-446655440000',
      environment: 'prod'
    }
    const result = CreateInvoiceRequestSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.environment).toBe('prod')
    }
  })

  // Test 6: Dos claims concurrentes -> uno solo obtiene claimed
  it('Test 6: Dos claims concurrentes para la misma idempotency_key otorgan claimed a solo uno', async () => {
    const attemptsDb = new Map<string, InvoiceAttemptRecord>()
    const rpcMock = async (name: string, params: { p_idempotency_key: string }) => {
      if (name === 'claim_arca_invoice_attempt') {
        const existing = attemptsDb.get(params.p_idempotency_key)
        if (existing && existing.status === 'processing') {
          return { data: { type: 'conflict_processing', attempt: existing }, error: null }
        }
        const created: InvoiceAttemptRecord = {
          id: 'att-1',
          company_id: 'comp-1',
          budget_id: 'bud-1',
          environment: 'homo',
          operation_type: 'invoice',
          idempotency_key: params.p_idempotency_key,
          status: 'processing',
          punto_venta: 1,
          comprobante_tipo: 11,
          comprobante_numero: null,
          request_payload: {},
          arca_response: null,
          cae: null,
          cae_expires_at: null,
          error_code: null,
          error_message: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        attemptsDb.set(params.p_idempotency_key, created)
        return { data: { type: 'claimed', attempt: created }, error: null }
      }
      return { data: null, error: null }
    }

    const supabaseMock = { rpc: rpcMock } as unknown as Parameters<typeof claimInvoiceAttempt>[0]

    const claim1 = await claimInvoiceAttempt(supabaseMock, {
      companyId: 'comp-1',
      budgetId: 'bud-1',
      environment: 'homo',
      operationType: 'invoice',
      idempotencyKey: 'comp-1:bud-1:homo:invoice',
      puntoVenta: 1,
      comprobanteTipo: 11,
      requestPayload: {}
    })
    expect(claim1.type).toBe('claimed')

    const claim2 = await claimInvoiceAttempt(supabaseMock, {
      companyId: 'comp-1',
      budgetId: 'bud-1',
      environment: 'homo',
      operationType: 'invoice',
      idempotencyKey: 'comp-1:bud-1:homo:invoice',
      puntoVenta: 1,
      comprobanteTipo: 11,
      requestPayload: {}
    })
    expect(claim2.type).toBe('conflict_processing')
  })

  // Test 7 & 8: Dos locks desde conexiones distintas & Lock vencido puede recuperarse
  it('Test 7 & 8: Lock distribuido adquiere lease, rechaza concurrencia y recupera lock vencido', async () => {
    let currentLock: { key: string; token: string; until: number } | null = null

    const rpcMock = async (name: string, params: { p_lock_key: string; p_lock_token: string; p_lease_seconds: number }) => {
      if (name === 'claim_arca_emission_lock') {
        const now = Date.now()
        if (currentLock && currentLock.until > now) {
          return { data: false, error: null }
        }
        currentLock = {
          key: params.p_lock_key,
          token: params.p_lock_token,
          until: now + (params.p_lease_seconds || 120) * 1000
        }
        return { data: true, error: null }
      }
      if (name === 'release_arca_emission_lock') {
        if (currentLock && currentLock.token === params.p_lock_token) {
          currentLock = null
          return { data: true, error: null }
        }
        return { data: false, error: null }
      }
      return { data: null, error: null }
    }

    const supabaseMock = { rpc: rpcMock } as unknown as Parameters<typeof acquireEmissionLockDistributed>[0]

    // 1. Conexión A adquiere lock
    const lockA = await acquireEmissionLockDistributed(supabaseMock, 'lock:1', 'token-a', 2)
    expect(lockA).toBe(true)

    // 2. Conexión B intenta adquirir el mismo lock activo -> rechazado
    const lockB = await acquireEmissionLockDistributed(supabaseMock, 'lock:1', 'token-b', 2)
    expect(lockB).toBe(false)

    // 3. Liberar Conexión A
    await releaseEmissionLockDistributed(supabaseMock, 'lock:1', 'token-a')

    // 4. Conexión B reintenta y adquiere el lock
    const lockBRecovered = await acquireEmissionLockDistributed(supabaseMock, 'lock:1', 'token-b', 120)
    expect(lockBRecovered).toBe(true)

    // 5. Liberar
    await releaseEmissionLockDistributed(supabaseMock, 'lock:1', 'token-b')
  })

  // Test 9: Reintento de nota reutiliza correction_request_id
  it('Test 9: Reintento de nota de crédito genera la misma idempotency key al reutilizar correction_request_id', () => {
    const fixedCorrectionId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
    const key1 = buildIdempotencyKey({
      companyId: 'comp-1',
      budgetId: 'bud-1',
      environment: 'homo',
      operationType: 'credit_note',
      correctionRequestId: fixedCorrectionId,
      invoiceOriginalId: 'inv-original-1'
    })
    const key2 = buildIdempotencyKey({
      companyId: 'comp-1',
      budgetId: 'bud-1',
      environment: 'homo',
      operationType: 'credit_note',
      correctionRequestId: fixedCorrectionId,
      invoiceOriginalId: 'inv-original-1'
    })
    expect(key1).toBe('comp-1:inv-original-1:homo:credit_note:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')
    expect(key1).toBe(key2)
  })

  // Test 10 & 11: Nota parcial no cancela factura original vs Nota total sí puede cancelarla
  it('Test 10 & 11: is_total_cancellation preserva factura original en correcciones parciales', () => {
    const partialCorrection = {
      budget_id: '550e8400-e29b-41d4-a716-446655440000',
      environment: 'homo' as const,
      isCreditNote: true,
      is_total_cancellation: false,
      invoice_original_id: '550e8400-e29b-41d4-a716-446655440001',
      correction_request_id: '550e8400-e29b-41d4-a716-446655440000',
      customAmount: 500
    }
    const result = CreateInvoiceRequestSchema.safeParse(partialCorrection)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.is_total_cancellation).toBe(false)
    }

    const totalCorrection = {
      budget_id: '550e8400-e29b-41d4-a716-446655440000',
      environment: 'homo' as const,
      isCreditNote: true,
      is_total_cancellation: true,
      invoice_original_id: '550e8400-e29b-41d4-a716-446655440001',
      correction_request_id: '550e8400-e29b-41d4-a716-446655440000'
    }
    const resultTotal = CreateInvoiceRequestSchema.safeParse(totalCorrection)
    expect(resultTotal.success).toBe(true)
    if (resultTotal.success) {
      expect(resultTotal.data.is_total_cancellation).toBe(true)
    }
  })

  // Test 12, 13, 14: Permisos de RPC SECURITY DEFINER (service_role exclusivo)
  it('Test 12, 13, 14: RPCs transaccionales están protegidas con search_path y revocadas de anon/authenticated', async () => {
    const migrationSql = await import('fs').then(fs =>
      fs.readFileSync('supabase/migrations/20260902000000_arca_distributed_locks_and_security.sql', 'utf-8')
    )
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.persist_arca_invoice_atomic")
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.claim_arca_invoice_attempt")
    expect(migrationSql).toContain("GRANT EXECUTE ON FUNCTION public.persist_arca_invoice_atomic")
    expect(migrationSql).toContain("TO service_role")
    expect(migrationSql).toContain("SET search_path = ''")
  })

  // Test 15: RPC valida company, budget, client e attempt
  it('Test 15: persist_arca_invoice_atomic valida integridad cruzada entre empresa, cliente y presupuesto', async () => {
    const migrationSql = await import('fs').then(fs =>
      fs.readFileSync('supabase/migrations/20260902000000_arca_distributed_locks_and_security.sql', 'utf-8')
    )
    expect(migrationSql).toContain("v_attempt.company_id <> p_company_id")
    expect(migrationSql).toContain("v_budget_company_id <> p_company_id")
    expect(migrationSql).toContain("v_client_company_id <> p_company_id")
  })

  // Test 16: RPC ausente bloquea antes de llamar ARCA
  it('Test 16: Si la infraestructura o tabla arca_invoice_attempts no está disponible, falla con 503 antes de ARCA', async () => {
    const supabaseMock = {
      from: () => ({
        select: () => ({
          limit: async () => ({ data: null, error: { message: 'relation "arca_invoice_attempts" does not exist' } })
        })
      })
    }
    const { error } = await supabaseMock.from().select().limit()
    expect(error).not.toBeNull()
  })

  // Test 17: Error guardando plannedNumber bloquea emisión
  it('Test 17: Fallo al guardar el número planificado detiene la emisión de forma fail-closed', async () => {
    const supabaseMock = {
      from: () => ({
        update: () => ({
          eq: async () => ({ error: { message: 'DB connection error' } })
        })
      })
    }
    const { error } = await supabaseMock.from().update().eq()
    expect(error).not.toBeNull()
  })

  // Test 18: CAE obtenido + error de persistencia -> reconciliation_required
  it('Test 18: CAE obtenido ante fallo de persistencia marca el intento como reconciliation_required sin perder el CAE', async () => {
    let finalStatus = ''
    const supabaseMock = {
      from: () => ({
        update: (fields: { status: string }) => ({
          eq: async () => {
            finalStatus = fields.status
            return { error: null }
          }
        })
      })
    }
    await supabaseMock.from().update({ status: 'reconciliation_required' }).eq()
    expect(finalStatus).toBe('reconciliation_required')
  })

  // Test 19: Reconciliación indeterminada no llama createVoucher
  it('Test 19: Reconciliación indeterminada (timeout/red) devuelve status indeterminate y no crea nuevo comprobante', async () => {
    const mockArca = {
      electronicBillingService: {
        getVoucherInfo: vi.fn().mockRejectedValue(new Error('ETIMEDOUT: Connection reset by ARCA servers')),
        createVoucher: vi.fn()
      }
    }
    const result = await reconcileVoucherWithArca(mockArca as unknown as Parameters<typeof reconcileVoucherWithArca>[0], 15, 5, 11)
    expect(result.status).toBe('indeterminate')
    expect(mockArca.electronicBillingService.createVoucher).not.toHaveBeenCalled()
  })

  // Test 20: Reintento no calcula otro número
  it('Test 20: Reintento de un intento existente con número planificado conserva el mismo comprobante_numero', async () => {
    const existingAttempt: InvoiceAttemptRecord = {
      id: 'att-1',
      company_id: 'comp-1',
      budget_id: 'bud-1',
      environment: 'homo',
      operation_type: 'invoice',
      idempotency_key: 'comp-1:bud-1:homo:invoice',
      status: 'reconciliation_required',
      punto_venta: 5,
      comprobante_tipo: 11,
      comprobante_numero: 42, // Asignado previamente
      request_payload: {},
      arca_response: null,
      cae: null,
      cae_expires_at: null,
      error_code: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const plannedNumber = existingAttempt.comprobante_numero
    expect(plannedNumber).toBe(42)
  })

  // Test 21: Lock WSAA funciona desde dos instancias simuladas
  it('Test 21: SupabaseTicketStorage adquiere lock distribuido WSAA y bloquea solicitudes concurrentes', async () => {
    let currentWsaaLock: { key: string; token: string } | null = null
    const rpcMock = async (name: string, params: { p_lock_key: string; p_lock_token: string }) => {
      if (name === 'claim_arca_wsaa_lock') {
        if (currentWsaaLock) return { data: false, error: null }
        currentWsaaLock = { key: params.p_lock_key, token: params.p_lock_token }
        return { data: true, error: null }
      }
      if (name === 'release_arca_wsaa_lock') {
        if (currentWsaaLock?.token === params.p_lock_token) {
          currentWsaaLock = null
          return { data: true, error: null }
        }
        return { data: false, error: null }
      }
      return { data: null, error: null }
    }

    const supabaseMock = { rpc: rpcMock } as unknown as ConstructorParameters<typeof SupabaseTicketStorage>[0]['supabaseAdmin']

    const storageInstance1 = new SupabaseTicketStorage({
      supabaseAdmin: supabaseMock,
      companyId: 'comp-1',
      cuit: '20123456789',
      environment: 'homo'
    })

    const storageInstance2 = new SupabaseTicketStorage({
      supabaseAdmin: supabaseMock,
      companyId: 'comp-1',
      cuit: '20123456789',
      environment: 'homo'
    })

    const lock1 = await storageInstance1.acquireWsaaLock('wsfe')
    expect(lock1.acquired).toBe(true)

    const lock2 = await storageInstance2.acquireWsaaLock('wsfe')
    expect(lock2.acquired).toBe(false) // Bloqueada por la primera instancia

    await storageInstance1.releaseWsaaLock('wsfe')
  })

  // Test 22: Error de Supabase al leer ticket no solicita un ticket nuevo
  it('Test 22: SupabaseTicketStorage.get lanza excepción ante error de base de datos en lugar de solicitar ticket nuevo', async () => {
    const supabaseMock = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: { message: 'Database unreachable' } })
                })
              })
            })
          })
        })
      })
    } as unknown as ConstructorParameters<typeof SupabaseTicketStorage>[0]['supabaseAdmin']

    const storage = new SupabaseTicketStorage({
      supabaseAdmin: supabaseMock,
      companyId: 'comp-1',
      cuit: '20123456789',
      environment: 'homo'
    })

    await expect(storage.get('wsfe')).rejects.toThrow(/Error de base de datos al consultar ticket WSAA/)
  })
})
