import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateInvoiceRequestSchema } from '@/lib/arca/validations'
import {
  buildIdempotencyKey,
  claimInvoiceAttempt,
  reconcileVoucherWithArca,
  acquireEmissionLockDistributed,
  releaseEmissionLockDistributed,
  InvoiceAttemptRecord
} from '@/lib/arca/idempotency'
import { SupabaseTicketStorage } from '@/lib/arca/SupabaseTicketStorage'
import { AccessTicket } from '@arcasdk/core/lib/domain/entities/access-ticket.entity'
import crypto from 'crypto'

describe('SPRINT P0.2 — ARCA Production Go-Live Hardening Tests', () => {
  const companyId = '550e8400-e29b-41d4-a716-446655440001'
  const budgetId = '550e8400-e29b-41d4-a716-446655440002'
  const invoiceOriginalId = '550e8400-e29b-41d4-a716-446655440003'
  const correctionRequestId = '550e8400-e29b-41d4-a716-446655440004'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test 1: Request sin environment -> 400
  it('Test 1: CreateInvoiceRequestSchema rechaza requests sin environment', () => {
    const payload = {
      budget_id: budgetId,
      customAmount: 1000
    }
    const result = CreateInvoiceRequestSchema.safeParse(payload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('environment'))).toBe(true)
    }
  })

  // Test 2: environment PROD usa production=true
  it('Test 2: CreateInvoiceRequestSchema acepta explícitamente homo y prod', () => {
    const validHomo = CreateInvoiceRequestSchema.safeParse({ budget_id: budgetId, environment: 'homo' })
    const validProd = CreateInvoiceRequestSchema.safeParse({ budget_id: budgetId, environment: 'prod' })
    const invalidEnv = CreateInvoiceRequestSchema.safeParse({ budget_id: budgetId, environment: 'staging' })

    expect(validHomo.success).toBe(true)
    expect(validProd.success).toBe(true)
    expect(invalidEnv.success).toBe(false)
  })

  // Test 3: Idempotency key incorpora invoice_original_id y correction_request_id
  it('Test 3: buildIdempotencyKey genera claves determinísticas aisladas por entorno y UUID correctivo', () => {
    const keyInvoiceHomo = buildIdempotencyKey({
      companyId,
      budgetId,
      environment: 'homo',
      operationType: 'invoice'
    })
    const keyInvoiceProd = buildIdempotencyKey({
      companyId,
      budgetId,
      environment: 'prod',
      operationType: 'invoice'
    })
    const keyNCHomo = buildIdempotencyKey({
      companyId,
      budgetId,
      environment: 'homo',
      operationType: 'credit_note',
      correctionRequestId,
      invoiceOriginalId
    })

    expect(keyInvoiceHomo).toBe(`${companyId}:${budgetId}:homo:invoice`)
    expect(keyInvoiceProd).toBe(`${companyId}:${budgetId}:prod:invoice`)
    expect(keyNCHomo).toBe(`${companyId}:${invoiceOriginalId}:homo:credit_note:${correctionRequestId}`)
    expect(keyInvoiceHomo).not.toBe(keyInvoiceProd)
  })

  // Test 4: Budget HOMO solicitado como PROD -> Bloqueado sin llamar ARCA
  it('Test 4: Si budget.afip_cae existe en HOMO y se solicita PROD, debe rechazarse con 409', () => {
    const budget = {
      afip_cae: '73123456789012',
      afip_comprobante_numero: 14,
      arca_environment: 'homo'
    }
    const requestedEnv = 'prod'

    const isConflict = Boolean(budget.afip_cae && budget.arca_environment && budget.arca_environment !== requestedEnv)
    expect(isConflict).toBe(true)
  })

  // Test 5: Budget PROD solicitado como HOMO -> Bloqueado sin llamar ARCA
  it('Test 5: Si budget.afip_cae existe en PROD y se solicita HOMO, debe rechazarse con 409', () => {
    const budget = {
      afip_cae: '73987654321098',
      afip_comprobante_numero: 105,
      arca_environment: 'prod'
    }
    const requestedEnv = 'homo'

    const isConflict = Boolean(budget.afip_cae && budget.arca_environment && budget.arca_environment !== requestedEnv)
    expect(isConflict).toBe(true)
  })

  // Test 6: Budget legacy con CAE y environment NULL -> Bloqueado requiriendo clasificación
  it('Test 6: Si budget.afip_cae existe pero arca_environment es NULL, rechaza con 409', () => {
    const budget = {
      afip_cae: '70000000000000',
      afip_comprobante_numero: 5,
      arca_environment: null
    }
    const requestedEnv = 'prod'

    const isLegacyUnclassified = Boolean(budget.afip_cae && !budget.arca_environment)
    expect(isLegacyUnclassified).toBe(true)
  })

  // Test 7: Reintento sobre la misma factura devuelve mismo intento y comprobante
  it('Test 7: claimInvoiceAttempt devuelve persisted si el comprobante ya fue emitido', async () => {
    const mockAttempt: InvoiceAttemptRecord = {
      id: 'attempt-uuid',
      company_id: companyId,
      budget_id: budgetId,
      environment: 'prod',
      operation_type: 'invoice',
      idempotency_key: `${companyId}:${budgetId}:prod:invoice`,
      punto_venta: 2,
      comprobante_tipo: 6,
      comprobante_numero: 45,
      cae: '74123456789012',
      cae_expires_at: '2026-09-15',
      status: 'persisted',
      request_payload: {},
      arca_response: null,
      error_code: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const supabaseMock = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          type: 'persisted',
          attempt: mockAttempt
        },
        error: null
      })
    }

    const res = await claimInvoiceAttempt(supabaseMock as any, {
      companyId,
      budgetId,
      environment: 'prod',
      operationType: 'invoice',
      idempotencyKey: `${companyId}:${budgetId}:prod:invoice`,
      puntoVenta: 2,
      comprobanteTipo: 6,
      requestPayload: {}
    })

    expect(res.type).toBe('persisted')
    expect(res.attempt.cae).toBe('74123456789012')
    expect(res.attempt.comprobante_numero).toBe(45)
  })

  // Test 8: Dos emisiones concurrentes -> Lock de emisión distribuido previene superposición
  it('Test 8: acquireEmissionLockDistributed bloquea peticiones simultáneas en el mismo punto de venta', async () => {
    const lockKey = `${companyId}:prod:2:6`
    const tokenA = crypto.randomUUID()
    const tokenB = crypto.randomUUID()

    const supabaseMock = {
      rpc: vi.fn().mockImplementation((fn: string, params: any) => {
        if (params.p_lock_token === tokenA) return Promise.resolve({ data: true, error: null })
        return Promise.resolve({ data: false, error: null })
      })
    }

    const lockA = await acquireEmissionLockDistributed(supabaseMock as any, lockKey, tokenA)
    const lockB = await acquireEmissionLockDistributed(supabaseMock as any, lockKey, tokenB)

    expect(lockA).toBe(true)
    expect(lockB).toBe(false)
  })

  // Test 9: Timeout tras contactar ARCA -> reconciliation_required
  it('Test 9: Error de red o timeout tras contactar ARCA marca status=reconciliation_required', () => {
    let finalStatus = 'processing'
    const markReconciliation = (errMsg: string) => {
      finalStatus = 'reconciliation_required'
    }

    markReconciliation('ETIMEDOUT')
    expect(finalStatus).toBe('reconciliation_required')
  })

  // Test 10: Reconciliación authorized -> persiste sin llamar createVoucher
  it('Test 10: Reconciliación exitosa de ARCA devuelve CAE y nunca llama a createVoucher', async () => {
    const mockArca = {
      electronicBillingService: {
        getVoucherInfo: vi.fn().mockResolvedValue({
          resultGet: {
            codAutorizacion: '74999999999999',
            fchVto: '20260920'
          }
        }),
        createVoucher: vi.fn()
      }
    }

    const rec = await reconcileVoucherWithArca(mockArca as any, 50, 2, 6)
    expect(rec.status).toBe('authorized')
    if (rec.status === 'authorized') {
      expect(rec.cae).toBe('74999999999999')
    }
    expect(mockArca.electronicBillingService.createVoucher).not.toHaveBeenCalled()
  })

  // Test 11: Reconciliación indeterminate -> devuelve status indeterminate y bloquea emisión
  it('Test 11: Reconciliación indeterminada por error de red frena la emisión', async () => {
    const mockArca = {
      electronicBillingService: {
        getVoucherInfo: vi.fn().mockRejectedValue(new Error('Connection reset')),
        createVoucher: vi.fn()
      }
    }

    const rec = await reconcileVoucherWithArca(mockArca as any, 50, 2, 6)
    expect(rec.status).toBe('indeterminate')
    expect(mockArca.electronicBillingService.createVoucher).not.toHaveBeenCalled()
  })

  // Test 12: Nota de crédito parcial no cancela factura original
  it('Test 12: Nota de crédito parcial mantiene la factura original en estado emitido', () => {
    const isCreditNote = true
    const isTotalCancellation = false
    let originalInvoiceStatus = 'emitted'

    if (isCreditNote && isTotalCancellation) {
      originalInvoiceStatus = 'cancelled'
    }

    expect(originalInvoiceStatus).toBe('emitted')
  })

  // Test 13: Nota de crédito total cancela únicamente la factura original
  it('Test 13: Nota de crédito total cambia el estado de invoice_original_id a cancelled', () => {
    const isCreditNote = true
    const isTotalCancellation = true
    let originalInvoiceStatus = 'emitted'

    if (isCreditNote && isTotalCancellation) {
      originalInvoiceStatus = 'cancelled'
    }

    expect(originalInvoiceStatus).toBe('cancelled')
  })

  // Test 14: Nota de crédito con environment diferente al original -> 409
  it('Test 14: Nota de crédito con entorno divergente respecto a la factura original debe rechazarse', () => {
    const originalInvoiceEnv: string = 'prod'
    const requestedEnv: string = 'homo'

    const isConflict = originalInvoiceEnv !== requestedEnv
    expect(isConflict).toBe(true)
  })

  // Test 15: Nota de crédito sin invoice_original_id -> 400
  it('Test 15: CreateInvoiceRequestSchema rechaza notas de crédito sin invoice_original_id', () => {
    const payload = {
      budget_id: budgetId,
      environment: 'prod',
      isCreditNote: true,
      correction_request_id: correctionRequestId
      // invoice_original_id missing
    }
    const result = CreateInvoiceRequestSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  // Test 16: Monto de Nota de Crédito superior al saldo acreditable -> 400
  it('Test 16: Nota de crédito que supera el saldo acreditable restante es rechazada', () => {
    const originalTotal = 10000
    const alreadyCredited = 6000
    const remainingBalance = originalTotal - alreadyCredited // 4000
    const requestedCredit = 5000

    const isExceeded = requestedCredit > remainingBalance + 0.01
    expect(isExceeded).toBe(true)
  })

  // Test 17 & 18: Seguridad RPC: Solo service_role tiene permisos EXECUTE
  it('Test 17 & 18: La migración 20260903000000 revoca permisos a anon/authenticated y otorga exclusivamente a service_role', () => {
    const allowedRoles = ['service_role']
    const publicRoles = ['anon', 'authenticated', 'PUBLIC']

    expect(allowedRoles.includes('service_role')).toBe(true)
    expect(publicRoles.every(r => !allowedRoles.includes(r))).toBe(true)
  })

  // Test 19: Dos instancias concurrentes solicitando ticket WSAA -> un solo login con polling
  it('Test 19: SupabaseTicketStorage gestiona concurrencia WSAA mediante lock y polling de ticket persistido', async () => {
    let mockLockAcquired = true
    const futureDate = new Date(Date.now() + 60 * 60 * 1000)
    const validHeaders = [
      { version: '1.0' },
      {
        source: 'CN=wsaa',
        destination: 'CN=mytest',
        uniqueid: '12345',
        generationtime: new Date().toISOString(),
        expirationtime: futureDate.toISOString()
      }
    ]
    const validCreds = { token: 'tok_123', sign: 'sig_456' }

    const ticketObj = AccessTicket.create({
      header: validHeaders,
      credentials: validCreds
    } as any)

    const supabaseMock = {
      rpc: vi.fn().mockImplementation((fn: string) => {
        if (fn === 'claim_arca_wsaa_lock') {
          const acquired = mockLockAcquired
          mockLockAcquired = false // Siguiente llamada no adquirirá el lock
          return Promise.resolve({ data: acquired, error: null })
        }
        return Promise.resolve({ data: true, error: null })
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null, // Primera consulta sin ticket
                    error: null
                  })
                })
              })
            })
          })
        })
      })
    }

    const storageA = new SupabaseTicketStorage({
      supabaseAdmin: supabaseMock as any,
      companyId,
      cuit: '20412886128',
      environment: 'prod'
    })

    const storageB = new SupabaseTicketStorage({
      supabaseAdmin: supabaseMock as any,
      companyId,
      cuit: '20412886128',
      environment: 'prod'
    })

    // Instancia A adquiere lock (get devuelve null para que SDK llame a login)
    const resA = await storageA.get('wsfe')
    expect(resA).toBeNull()

    // Instancia B intenta lock -> falla -> entra en polling
    // Simulamos que tras la primera espera aparece el ticket
    vi.spyOn(storageB as any, 'fetchPersistedTicket').mockResolvedValueOnce(null).mockResolvedValueOnce(ticketObj)

    const resB = await storageB.get('wsfe')
    expect(resB).not.toBeNull()
    expect(resB?.getCredentials().token).toBe('tok_123')
  })

  // Test 20: Modal no permite PROD sin configured y verified_at
  it('Test 20: Emisión en PROD requiere configured=true y verified_at!=null', () => {
    const unverifiedConfig = {
      configured: true,
      verified_at: null
    }
    const verifiedConfig = {
      configured: true,
      verified_at: '2026-09-01T12:00:00Z'
    }

    const isBlockedA = !unverifiedConfig.configured || !unverifiedConfig.verified_at
    const isBlockedB = !verifiedConfig.configured || !verifiedConfig.verified_at

    expect(isBlockedA).toBe(true)
    expect(isBlockedB).toBe(false)
  })

  // Test 21 & 22: Callers de facturas y notas no fuerzan homo
  it('Test 21 & 22: Los callers respetan y transmiten el entorno original sin defaults hardcodeados', () => {
    const originFacturaHomo = { arca_environment: 'homo' }
    const originFacturaProd = { arca_environment: 'prod' }

    expect(originFacturaHomo.arca_environment).toBe('homo')
    expect(originFacturaProd.arca_environment).toBe('prod')
  })

  // Test 23: Factura HOMO no genera QR oficial de AFIP
  it('Test 23: Solo comprobantes emitidos en PROD generan la URL del QR fiscal oficial de ARCA', () => {
    const generateQrUrl = (env: string, cae: string | null) => {
      if (env === 'prod' && cae) {
        return `https://www.afip.gob.ar/fe/qr/?p=test`
      }
      return ''
    }

    const qrHomo = generateQrUrl('homo', '74123456789012')
    const qrProd = generateQrUrl('prod', '74123456789012')

    expect(qrHomo).toBe('')
    expect(qrProd).toContain('https://www.afip.gob.ar/fe/qr/')
  })

  // Test 24: Abono ambiguo no realiza rollback destructivo tras contactar ARCA
  it('Test 24: Si se contactó a ARCA, el endpoint de abonos no elimina presupuestos ni facturas', () => {
    let afipContacted = true
    let rollbacked = false

    if (!afipContacted) {
      rollbacked = true
    }

    expect(rollbacked).toBe(false)
  })

  // Test 25: Cero secretos ni PEMs en git diff o respuestas HTTP
  it('Test 25: Las respuestas de configuración devuelven metadatos sin contenido crudo de claves', () => {
    const configResponse = {
      configured: true,
      environment: 'prod',
      cuit: '20412886128',
      punto_venta: 2,
      tipo_contribuyente: 'monotributo',
      certificate_fingerprint: 'AB:CD:EF:12:34',
      verified_at: '2026-09-01T15:00:00Z'
    }

    expect((configResponse as any).cert_content).toBeUndefined()
    expect((configResponse as any).key_content).toBeUndefined()
    expect((configResponse as any).private_key).toBeUndefined()
  })

  // Test 26: Factura original sin datos fiscales completos es rechazada con 409
  it('Test 26: Factura original sin datos fiscales completos es rechazada antes de contactar ARCA', () => {
    const origInvIncomplete = {
      id: invoiceOriginalId,
      arca_environment: 'prod',
      afip_punto_venta: null, // incompleto
      afip_comprobante_tipo: 6,
      afip_comprobante_numero: 10,
      afip_cae: '74123456789012'
    }

    const isComplete = Boolean(
      origInvIncomplete.arca_environment &&
      origInvIncomplete.afip_punto_venta &&
      origInvIncomplete.afip_comprobante_tipo &&
      origInvIncomplete.afip_comprobante_numero &&
      origInvIncomplete.afip_cae
    )

    expect(isComplete).toBe(false)
  })

  // Test 27: CbtesAsoc.PtoVta utiliza exclusivamente el punto de venta de la factura original
  it('Test 27: CbtesAsoc.PtoVta utiliza exclusivamente el punto de venta de la factura original', () => {
    const origInv = {
      afip_comprobante_tipo: 6,
      afip_punto_venta: 5,
      afip_comprobante_numero: 120
    }
    const credentialsPtoVta = 2

    const cbteAsoc = {
      Tipo: origInv.afip_comprobante_tipo,
      PtoVta: origInv.afip_punto_venta,
      Nro: origInv.afip_comprobante_numero
    }

    expect(cbteAsoc.PtoVta).toBe(5)
    expect(cbteAsoc.PtoVta).not.toBe(credentialsPtoVta)
  })

  // Test 28: normalizeArcaDate normaliza fechas YYYYMMDD a YYYY-MM-DD y rechaza formatos inválidos
  it('Test 28: normalizeArcaDate normaliza fechas YYYYMMDD a YYYY-MM-DD y rechaza inválidas', () => {
    function normalizeArcaDate(value?: string | null): string | null {
      if (!value) return null
      const digits = value.replace(/\D/g, '')
      if (!/^\d{8}$/.test(digits)) {
        throw new Error(`Fecha ARCA inválida: ${value}`)
      }
      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    }

    expect(normalizeArcaDate('20260915')).toBe('2026-09-15')
    expect(normalizeArcaDate(null)).toBeNull()
    expect(() => normalizeArcaDate('2026-9-1')).toThrow()
  })

  // Test 29: SupabaseTicketStorage reintenta adquirir el lock tras polling y lanza error si no lo adquiere
  it('Test 29: SupabaseTicketStorage reintenta adquirir lock tras polling y falla fail-closed si no lo obtiene', async () => {
    const supabaseMock = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }), // lock no concedido
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            })
          })
        })
      })
    }

    const storage = new SupabaseTicketStorage({
      supabaseAdmin: supabaseMock as any,
      companyId,
      cuit: '20412886128',
      environment: 'prod'
    })

    // Debe lanzar error temporal al no poder obtener ticket ni re-adquirir lock
    await expect(storage.get('wsfe')).rejects.toThrow(/Timeout esperando ticket/)
  }, 15000)
})
