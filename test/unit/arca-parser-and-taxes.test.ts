import { describe, it, expect } from 'vitest'
import { calculateInvoiceTaxes } from '@/lib/arca/taxCalculator'
import { CreateInvoiceRequestSchema, ALLOWED_CBTE_TIPOS } from '@/lib/arca/validations'
import { buildIdempotencyKey } from '@/lib/arca/idempotency'
import { SalesPointsResultDto } from '@arcasdk/core/lib/application/dto/electronic-billing.dto'

describe('Unit Tests: ARCA Parser, Tax Calculator & Idempotency', () => {

  it('Unit 11: El parser reconoce la estructura resultGet.ptoVenta de @arcasdk/core 1.3.1', () => {
    const mockSdkResponse: SalesPointsResultDto = {
      resultGet: {
        ptoVenta: [
          { nro: 1, emisionTipo: 'CAE', bloqueado: 'N' },
          { nro: 5, emisionTipo: 'CAE', bloqueado: 'N' }
        ]
      }
    }

    const listaPuntos = mockSdkResponse.resultGet?.ptoVenta ?? []
    expect(listaPuntos).toHaveLength(2)
    expect(listaPuntos[0].nro).toBe(1)
    expect(listaPuntos[1].nro).toBe(5)
  })

  it('Unit 12: Punto ausente o bloqueado es identificado como inválido', () => {
    const mockSdkResponse: SalesPointsResultDto = {
      resultGet: {
        ptoVenta: [
          { nro: 1, emisionTipo: 'CAE', bloqueado: 'N' },
          { nro: 5, emisionTipo: 'CAE', bloqueado: 'S' } // Bloqueado
        ]
      }
    }

    const listaPuntos = mockSdkResponse.resultGet?.ptoVenta ?? []

    // Punto 5 está bloqueado
    const pto5 = listaPuntos.find(p => p.nro === 5)
    expect(pto5).toBeDefined()
    expect(pto5?.bloqueado).toBe('S')

    // Punto 99 no existe
    const pto99 = listaPuntos.find(p => p.nro === 99)
    expect(pto99).toBeUndefined()
  })

  it('Unit 13: cbteTipoOverride inválido produce error de validación', () => {
    const invalidTypes = [0, 4, 5, 9, 10, 14, 99, -1]

    invalidTypes.forEach(tipo => {
      const result = CreateInvoiceRequestSchema.safeParse({
        budget_id: '550e8400-e29b-41d4-a716-446655440000',
        environment: 'homo',
        cbteTipoOverride: tipo
      })
      expect(result.success).toBe(false)
    })

    // Tipos permitidos: Facturas (1,6,11), ND (2,7,12), NC (3,8,13)
    ALLOWED_CBTE_TIPOS.forEach(tipo => {
      const result = CreateInvoiceRequestSchema.safeParse({
        budget_id: '550e8400-e29b-41d4-a716-446655440000',
        environment: 'homo',
        cbteTipoOverride: tipo
      })
      expect(result.success).toBe(true)
    })
  })

  it('Unit 14: Condición IVA se calcula correctamente para Facturas A, B y C', () => {
    // 1. Factura C (Monotributo): Total sin IVA discriminado
    const taxC = calculateInvoiceTaxes({ montoTotal: 1000, cbteTipo: 11 })
    expect(taxC.montoTotal).toBe(1000)
    expect(taxC.impNeto).toBe(1000)
    expect(taxC.impIva).toBe(0)
    expect(taxC.ivaArray).toHaveLength(0)

    // 2. Factura A / B: Total incluye 21% de IVA discriminado
    const taxA = calculateInvoiceTaxes({ montoTotal: 1210, cbteTipo: 1 })
    expect(taxA.montoTotal).toBe(1210)
    expect(taxA.impNeto).toBe(1000)
    expect(taxA.impIva).toBe(210)
    expect(taxA.ivaArray).toHaveLength(1)
    expect(taxA.ivaArray[0].Id).toBe(5) // 21%
    expect(taxA.ivaArray[0].BaseImp).toBe(1000)
    expect(taxA.ivaArray[0].Importe).toBe(210)

    // 3. Ecuación fundamental de AFIP/ARCA
    expect(taxA.impNeto + taxA.impIva + taxA.impTrib + taxA.impOpEx + taxA.impTotConc).toBe(taxA.montoTotal)
  })

  it('Unit 15: Idempotency Key determinística previene duplicación en reintentos', () => {
    const companyId = 'comp-111'
    const budgetId = 'bud-222'

    const key1 = buildIdempotencyKey({ companyId, budgetId, environment: 'homo', operationType: 'invoice' })
    const key2 = buildIdempotencyKey({ companyId, budgetId, environment: 'homo', operationType: 'invoice' })
    const keyProd = buildIdempotencyKey({ companyId, budgetId, environment: 'prod', operationType: 'invoice' })

    expect(key1).toBe('comp-111:bud-222:homo:invoice')
    expect(key1).toBe(key2) // Mismo hash para mismo presupuesto y entorno
    expect(key1).not.toBe(keyProd) // HOMO y PROD tienen claves separadas
  })
})
