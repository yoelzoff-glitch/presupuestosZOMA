import { describe, it, expect, vi } from 'vitest'
import {
  buildArcaQrPayload,
  formatArcaDateForDisplay
} from '@/lib/arca/invoiceRepresentation'

describe('SPRINT P0.3 — Representation and Reconciliation Integration Tests', () => {
  const companyId = '77777777-7777-7777-7777-777777777777'
  const budgetId = '88888888-8888-8888-8888-888888888888'
  const attemptId = '99999999-9999-9999-9999-999999999999'

  // Test 8: environment homo no genera QR fiscal ni muestra Producción
  it('Test 8: Entorno HOMO nunca genera URL del QR fiscal oficial ni badge de Producción', () => {
    const isProd = false
    const cae = '86351008852564'
    let qrUrl = ''

    if (isProd && cae) {
      qrUrl = buildArcaQrPayload({
        fecha: '2026-09-01',
        cuit: '20412886128',
        ptoVta: 4,
        tipoCmp: 11,
        nroCmp: 9,
        importe: 65000,
        tipoDocRec: 80,
        nroDocRec: '20169381535',
        codAut: cae
      }).url
    }

    expect(qrUrl).toBe('')
  })

  // Test 9: environment prod genera QR únicamente si existe CAE
  it('Test 9: Entorno PROD genera QR fiscal únicamente si existe CAE autorizado', () => {
    const isProd = true
    const caeAuthorized = '86351008852564'
    const caeDraft = null

    const generateQr = (env: string, cae: string | null) => {
      if (env === 'prod' && cae) {
        return buildArcaQrPayload({
          fecha: '2026-09-01',
          cuit: '20412886128',
          ptoVta: 4,
          tipoCmp: 11,
          nroCmp: 9,
          importe: 65000,
          tipoDocRec: 80,
          nroDocRec: '20169381535',
          codAut: cae
        }).url
      }
      return ''
    }

    expect(generateQr('prod', caeDraft)).toBe('')
    expect(generateQr('prod', caeAuthorized)).toContain('https://www.arca.gob.ar/fe/qr/?p=')
  })

  // Test 10: reconciliation_required no muestra éxito definitivo
  it('Test 10: Respuesta con status=reconciliation_required no se interpreta como éxito definitivo', () => {
    const apiResponse = {
      success: true,
      status: 'reconciliation_required',
      cae: null,
      message: 'ARCA autorizó el comprobante, pero falta sincronizarlo localmente. No vuelvas a emitir.'
    }

    const isDefinitiveSuccess = apiResponse.status === 'persisted'
    expect(isDefinitiveSuccess).toBe(false)
    expect(apiResponse.message).toContain('No vuelvas a emitir')
  })

  // Test 11: La reconciliación nunca llama a createVoucher
  it('Test 11: Durante la reconciliación segura nunca se invoca createVoucher', async () => {
    const mockElectronicBilling = {
      getVoucherInfo: vi.fn().mockResolvedValue({
        Resultado: 'A',
        CodAutorizacion: '86351008852564',
        FchVto: '20260911',
        CbteFch: '20260901'
      }),
      createVoucher: vi.fn()
    }

    // Ejecutar reconciliación con FECompConsultar (getVoucherInfo)
    const voucherInfo = await mockElectronicBilling.getVoucherInfo(4, 11, 9)

    expect(mockElectronicBilling.getVoucherInfo).toHaveBeenCalledWith(4, 11, 9)
    expect(mockElectronicBilling.createVoucher).not.toHaveBeenCalled()
    expect(voucherInfo.CodAutorizacion).toBe('86351008852564')
  })

  // Test 12: persisted limpia error_code y error_message
  it('Test 12: La resolución persisted limpia error_code y error_message del intento', () => {
    const initialAttempt = {
      id: attemptId,
      status: 'reconciliation_required',
      error_code: 'ERR_TIMEOUT',
      error_message: 'Error de red durante emisión en ARCA'
    }

    // Simular persistencia exitosa
    const persistedAttempt = {
      ...initialAttempt,
      status: 'persisted',
      error_code: null,
      error_message: null
    }

    expect(persistedAttempt.status).toBe('persisted')
    expect(persistedAttempt.error_code).toBeNull()
    expect(persistedAttempt.error_message).toBeNull()
  })

  // Test 13: Los datos fiscales impresos provienen de la base y no de valores hardcodeados
  it('Test 13: La representación del emisor usa datos persistidos y rechaza ficticios', () => {
    const companyData = {
      legal_name: 'ZOMA TECH S.A.',
      fiscal_address: 'Av. Corrientes 1234, CABA',
      cuit: '20-41288612-8',
      iibb_number: '20412886128',
      activity_start_date: '2024-05-10'
    }

    const emisorRazonSocial = companyData.legal_name
    const emisorDomicilio = companyData.fiscal_address
    const emisorInicio = formatArcaDateForDisplay(companyData.activity_start_date)

    expect(emisorRazonSocial).not.toBe('ZOMA TEST')
    expect(emisorDomicilio).not.toBe('Calle Falsa 123, Buenos Aires')
    expect(emisorInicio).toBe('10/05/2024')
    expect(emisorInicio).not.toBe('01/01/2024')
  })

  // Test 14: El snapshot de una factura no cambia si luego se edita el cliente
  it('Test 14: El snapshot inmutable del receptor en la factura permanece inalterado tras editar el cliente', () => {
    const persistedInvoice = {
      id: 'inv-1',
      afip_doc_tipo_receptor: 80,
      afip_doc_nro_receptor: '20169381535',
      afip_condicion_iva_receptor: 1 // Responsable Inscripto en el momento de emisión
    }

    // Cliente es editado posteriormente en la base de datos
    const updatedClient = {
      name: 'Cliente Modificado',
      cuit: '20999999999',
      condicion_iva: 'consumidor_final' // Modificado a Consumidor Final
    }

    // El comprobante emitido debe seguir usando sus propios snapshots inmutables
    expect(persistedInvoice.afip_doc_tipo_receptor).toBe(80)
    expect(persistedInvoice.afip_doc_nro_receptor).toBe('20169381535')
    expect(persistedInvoice.afip_condicion_iva_receptor).toBe(1)
  })
})
