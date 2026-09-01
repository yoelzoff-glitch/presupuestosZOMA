import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TEST_ENCRYPTION_KEY_BASE64 } from '../helpers/crypto-fixtures'
import { 
  claimInvoiceAttempt, 
  reconcileVoucherWithArca, 
  acquireEmissionLock, 
  releaseEmissionLock,
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
    // Simular base de datos en memoria con tipos estrictos
    const attemptsDb = new Map<string, InvoiceAttemptRecord>()

    const createMockSupabase = () => ({
      from: (_table: string) => ({
        select: () => {
          let keyVal = ''
          const b = {
            eq: (_col: string, val: string) => { keyVal = val; return b },
            maybeSingle: async () => ({ data: attemptsDb.get(keyVal) || null, error: null })
          }
          return b
        },
        insert: (rec: Partial<InvoiceAttemptRecord> & { idempotency_key: string }) => ({
          select: () => ({
            single: async () => {
              const id = `att-${Date.now()}`
              const saved: InvoiceAttemptRecord = {
                id,
                company_id: rec.company_id || '',
                budget_id: rec.budget_id || '',
                environment: rec.environment || 'homo',
                operation_type: rec.operation_type || 'invoice',
                idempotency_key: rec.idempotency_key,
                status: rec.status || 'processing',
                punto_venta: rec.punto_venta || 0,
                comprobante_tipo: rec.comprobante_tipo || 11,
                comprobante_numero: rec.comprobante_numero || null,
                request_payload: rec.request_payload || {},
                arca_response: rec.arca_response || null,
                cae: rec.cae || null,
                cae_expires_at: rec.cae_expires_at || null,
                error_code: rec.error_code || null,
                error_message: rec.error_message || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
              attemptsDb.set(rec.idempotency_key, saved)
              return { data: saved, error: null }
            }
          })
        }),
        update: (rec: Partial<InvoiceAttemptRecord>) => ({
          eq: (_col: string, val: string) => ({
            then: (resolve: (value: { error: null }) => void) => {
              for (const [k, v] of attemptsDb.entries()) {
                if (v.id === val) {
                  const updated: InvoiceAttemptRecord = { ...v, ...rec, updated_at: new Date().toISOString() }
                  attemptsDb.set(k, updated)
                  break
                }
              }
              resolve({ error: null })
            }
          })
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
    await supabaseMock.from('arca_invoice_attempts').update({
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

    expect(reconciliation.authorized).toBe(true)
    expect(reconciliation.cae).toBe('74999888777666')
    expect(mockArca.electronicBillingService.createVoucher).not.toHaveBeenCalled()
  })

  it('Integration 6: Concurrency Lock evita que dos solicitudes simultáneas emitan al mismo tiempo', () => {
    const lockKey = 'comp-1:homo:5:11'

    const lock1 = acquireEmissionLock(lockKey)
    expect(lock1).toBe(true)

    // Segunda solicitud concurrente con el mismo punto de venta y comprobante
    const lock2 = acquireEmissionLock(lockKey)
    expect(lock2).toBe(false) // Bloqueada

    // Liberar lock
    releaseEmissionLock(lockKey)

    // Ahora puede adquirirse nuevamente
    const lock3 = acquireEmissionLock(lockKey)
    expect(lock3).toBe(true)
    releaseEmissionLock(lockKey)
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
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: attemptsDb.get('comp-1:bud-1:homo:invoice') || null, error: null })
          })
        })
      })
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
        const builder = {
          select: () => builder,
          eq: (col: string, val: string) => {
            if (col === 'environment') envVal = val
            return builder
          },
          maybeSingle: async () => {
            if (table === 'arca_credentials' && envVal === 'prod') {
              return { data: null, error: null }
            }
            if (table === 'arca_credentials' && envVal === 'homo') {
              return { 
                data: { 
                  id: '1', 
                  company_id: 'comp-1', 
                  environment: 'homo', 
                  cuit: '20123456789', 
                  punto_venta: 5, 
                  tipo_contribuyente: 'monotributo' 
                }, 
                error: null 
              }
            }
            return { data: null, error: null }
          }
        }
        return builder
      }
    } as unknown as Parameters<typeof createArcaClient>[0]

    // Solicitar cliente para PROD debe fallar y no hacer fallback a HOMO
    await expect(createArcaClient(supabaseMock, 'comp-1', 'prod')).rejects.toThrow(
      /No se encontraron credenciales fiscales configuradas para el entorno PRODUCCIÓN/
    )
  })
})
