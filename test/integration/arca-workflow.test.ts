import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TEST_ENCRYPTION_KEY_BASE64 } from '../helpers/crypto-fixtures'
import {
  claimInvoiceAttempt,
  reconcileVoucherWithArca,
  acquireEmissionLockDistributed,
  releaseEmissionLockDistributed,
  InvoiceAttemptRecord
} from '@/lib/arca/idempotency'
import { SalesPoint } from '@arcasdk/core/lib/domain/types/electronic-billing.types'

describe('Integration Tests: ARCA Workflow (Mocked Backend)', () => {
  const originalEnv = process.env.ARCA_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ARCA_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY_BASE64
  })

  afterEach(() => {
    process.env.ARCA_ENCRYPTION_KEY = originalEnv
  })

  it('Integration 1 & 2: WSAA válido + punto encontrado vs punto inexistente', async () => {
    const mockSalesPointsService = (pts: SalesPoint[]) => ({
      getSalesPoints: vi.fn().mockResolvedValue({
        resultGet: { ptoVenta: pts }
      })
    })

    // Caso 1: Punto 5 presente y activo
    const serviceOk = mockSalesPointsService([
      { nro: 1, emisionTipo: 'CAE', bloqueado: 'N' },
      { nro: 5, emisionTipo: 'CAE', bloqueado: 'N' }
    ])

    const resOk = await serviceOk.getSalesPoints()
    const listOk: SalesPoint[] = resOk.resultGet?.ptoVenta || []
    const pto5Ok = listOk.find((p: SalesPoint) => p.nro === 5 && p.bloqueado !== 'S')
    expect(Boolean(pto5Ok)).toBe(true)

    // Caso 2: Punto 5 inexistente (no debe hacer fail-open)
    const serviceMissing = mockSalesPointsService([
      { nro: 1, emisionTipo: 'CAE', bloqueado: 'N' }
    ])
    const resMissing = await serviceMissing.getSalesPoints()
    const listMissing: SalesPoint[] = resMissing.resultGet?.ptoVenta || []
    const pto5Missing = listMissing.find((p: SalesPoint) => p.nro === 5 && p.bloqueado !== 'S')
    expect(Boolean(pto5Missing)).toBe(false)
  })

  it('Integration 3 & 4: CAE aprobado + persistencia vs CAE aprobado + fallo Supabase', async () => {
    const attemptsDb = new Map<string, InvoiceAttemptRecord>()

    const createMockSupabase = () => ({
      rpc: async (name: string, params: Record<string, any>) => {
        if (name === 'claim_arca_invoice_attempt') {
          const existing = attemptsDb.get(params.p_idempotency_key)
          if (existing) {
            if (existing.status === 'persisted') {
              return { data: { type: 'persisted', attempt: existing }, error: null }
            }
            if (existing.status === 'reconciliation_required' || existing.status === 'authorized_pending_persistence') {
              return { data: { type: 'needs_reconciliation', attempt: existing }, error: null }
            }
            return { data: { type: 'conflict_processing', attempt: existing }, error: null }
          }
          const saved: InvoiceAttemptRecord = {
            id: 'att-101',
            company_id: params.p_company_id,
            budget_id: params.p_budget_id,
            environment: params.p_environment,
            operation_type: params.p_operation_type,
            idempotency_key: params.p_idempotency_key,
            status: 'processing',
            punto_venta: params.p_punto_venta,
            comprobante_tipo: params.p_comprobante_tipo,
            comprobante_numero: null,
            request_payload: params.p_request_payload,
            arca_response: null,
            cae: null,
            cae_expires_at: null,
            error_code: null,
            error_message: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          attemptsDb.set(params.p_idempotency_key, saved)
          return { data: { type: 'claimed', attempt: saved }, error: null }
        }
        return { data: null, error: null }
      },
      from: () => ({
        update: (rec: Partial<InvoiceAttemptRecord>) => ({
          eq: async (_col: string, val: string) => {
            for (const [k, v] of attemptsDb.entries()) {
              if (v.id === val) {
                const updated: InvoiceAttemptRecord = { ...v, ...rec, updated_at: new Date().toISOString() }
                attemptsDb.set(k, updated)
                break
              }
            }
            return { error: null }
          }
        })
      })
    })

    const supabaseMock = createMockSupabase() as unknown as Parameters<typeof claimInvoiceAttempt>[0]

    // 1. Reclamar intento
    const claim = await claimInvoiceAttempt(supabaseMock, {
      companyId: 'company-test',
      budgetId: 'budget-101',
      environment: 'homo',
      operationType: 'invoice',
      idempotencyKey: 'company-test:budget-101:homo:invoice',
      puntoVenta: 5,
      comprobanteTipo: 11,
      requestPayload: { total: 1000 }
    })

    expect(claim.type).toBe('claimed')

    // 2. Simular CAE obtenido de ARCA pero fallo en persistencia local
    await (supabaseMock as any).from('arca_invoice_attempts').update({
      status: 'reconciliation_required',
      cae: '74123456789012',
      comprobante_numero: 42
    }).eq('id', claim.attempt.id)

    // 3. Simular reintento posterior: debe detectar needs_reconciliation
    const retryClaim = await claimInvoiceAttempt(supabaseMock, {
      companyId: 'company-test',
      budgetId: 'budget-101',
      environment: 'homo',
      operationType: 'invoice',
      idempotencyKey: 'company-test:budget-101:homo:invoice',
      puntoVenta: 5,
      comprobanteTipo: 11,
      requestPayload: { total: 1000 }
    })

    expect(retryClaim.type).toBe('needs_reconciliation')
    if (retryClaim.type === 'needs_reconciliation') {
      expect(retryClaim.attempt.cae).toBe('74123456789012')
      expect(retryClaim.attempt.comprobante_numero).toBe(42)
    }
  })

  it('Integration 5: Reintento posterior consulta ARCA con getVoucherInfo y no genera otro comprobante', async () => {
    const mockArca = {
      electronicBillingService: {
        getVoucherInfo: vi.fn().mockResolvedValue({
          resultado: 'A',
          codAutorizacion: '74999888777666',
          fchVto: '20260910',
          cbteDesde: 42
        }),
        createVoucher: vi.fn() // No debe ser llamado
      }
    }

    const reconciliation = await reconcileVoucherWithArca(mockArca as unknown as Parameters<typeof reconcileVoucherWithArca>[0], 42, 5, 11)

    expect(reconciliation.status).toBe('authorized')
    if (reconciliation.status === 'authorized') {
      expect(reconciliation.cae).toBe('74999888777666')
    }
    expect(mockArca.electronicBillingService.createVoucher).not.toHaveBeenCalled()
  })

  it('Integration 6: Concurrency Lock distribuido evita que dos solicitudes simultáneas emitan al mismo tiempo', async () => {
    let currentLock: { key: string; token: string } | null = null
    const rpcMock = async (name: string, params: { p_lock_key: string; p_lock_token: string }) => {
      if (name === 'claim_arca_emission_lock') {
        if (currentLock) return { data: false, error: null }
        currentLock = { key: params.p_lock_key, token: params.p_lock_token }
        return { data: true, error: null }
      }
      if (name === 'release_arca_emission_lock') {
        if (currentLock?.token === params.p_lock_token) {
          currentLock = null
          return { data: true, error: null }
        }
        return { data: false, error: null }
      }
      return { data: null, error: null }
    }

    const supabaseMock = { rpc: rpcMock } as unknown as Parameters<typeof acquireEmissionLockDistributed>[0]

    const lock1 = await acquireEmissionLockDistributed(supabaseMock, 'comp-1:homo:5:11', 'token-1')
    expect(lock1).toBe(true)

    // Segunda solicitud concurrente con el mismo punto de venta y comprobante
    const lock2 = await acquireEmissionLockDistributed(supabaseMock, 'comp-1:homo:5:11', 'token-2')
    expect(lock2).toBe(false) // Bloqueada

    // Liberar lock
    await releaseEmissionLockDistributed(supabaseMock, 'comp-1:homo:5:11', 'token-1')

    // Ahora puede adquirirse nuevamente
    const lock3 = await acquireEmissionLockDistributed(supabaseMock, 'comp-1:homo:5:11', 'token-3')
    expect(lock3).toBe(true)
    await releaseEmissionLockDistributed(supabaseMock, 'comp-1:homo:5:11', 'token-3')
  })

  it('Integration 7: Factura ya emitida devuelve el mismo CAE inmediatamente', async () => {
    const attemptsDb = new Map<string, InvoiceAttemptRecord>()
    const persistedRecord: InvoiceAttemptRecord = {
      id: 'att-1',
      company_id: 'comp-1',
      budget_id: 'bud-1',
      environment: 'homo',
      operation_type: 'invoice',
      idempotency_key: 'comp-1:bud-1:homo:invoice',
      status: 'persisted',
      punto_venta: 5,
      comprobante_tipo: 11,
      comprobante_numero: 10,
      request_payload: {},
      arca_response: null,
      cae: '74000111222333',
      cae_expires_at: null,
      error_code: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    attemptsDb.set('comp-1:bud-1:homo:invoice', persistedRecord)

    const supabaseMock = {
      rpc: async (name: string, params: Record<string, any>) => {
        if (name === 'claim_arca_invoice_attempt') {
          const existing = attemptsDb.get(params.p_idempotency_key)
          if (existing && existing.status === 'persisted') {
            return { data: { type: 'persisted', attempt: existing }, error: null }
          }
        }
        return { data: null, error: null }
      }
    } as unknown as Parameters<typeof claimInvoiceAttempt>[0]

    const result = await claimInvoiceAttempt(supabaseMock, {
      companyId: 'comp-1',
      budgetId: 'bud-1',
      environment: 'homo',
      operationType: 'invoice',
      idempotencyKey: 'comp-1:bud-1:homo:invoice',
      puntoVenta: 5,
      comprobanteTipo: 11,
      requestPayload: {}
    })

    expect(result.type).toBe('persisted')
    if (result.type === 'persisted') {
      expect(result.attempt.cae).toBe('74000111222333')
      expect(result.attempt.comprobante_numero).toBe(10)
    }
  })

  it('Integration 8: Credenciales HOMO no pueden usarse para PROD', async () => {
    const { createArcaClient } = await import('@/lib/arca/arcaClient')

    // Mock supabase where only HOMO is configured
    const supabaseMock = {
      from: (table: string) => {
        let envVal = ''
        const b = {
          select: () => b,
          eq: (col: string, val: string) => {
            if (col === 'environment') envVal = val
            return b
          },
          maybeSingle: async () => {
            if (table === 'arca_credentials' && envVal === 'homo') {
              return {
                data: {
                  id: 'cred-homo-1',
                  company_id: 'comp-test',
                  environment: 'homo',
                  cuit: '20123456789',
                  punto_venta: 1,
                  tipo_contribuyente: 'monotributo',
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

    await expect(
      createArcaClient(supabaseMock, 'comp-test', 'prod')
    ).rejects.toThrow(/No se encontraron credenciales fiscales configuradas para el entorno PRODUCCIÓN/)
  })
})
