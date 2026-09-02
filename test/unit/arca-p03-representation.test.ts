import { describe, it, expect } from 'vitest'
import {
  normalizeArcaDate,
  formatArcaDateForDisplay,
  getDefaultServiceDates,
  validateServiceDateOrder,
  buildArcaQrPayload,
  generateArcaQrDataUrl,
  getCondicionIvaLabel
} from '@/lib/arca/invoiceRepresentation'

describe('SPRINT P0.3 — Pure Representation and Dates Unit Tests', () => {
  // Test 1: Fecha 2026-09-01 siempre representada como 01/09/2026
  it('Test 1: Fecha 2026-09-01 se formatea como 01/09/2026', () => {
    expect(formatArcaDateForDisplay('2026-09-01')).toBe('01/09/2026')
    expect(formatArcaDateForDisplay('20260901')).toBe('01/09/2026')
  })

  // Test 2: Vencimiento 2026-09-11 siempre representado como 11/09/2026
  it('Test 2: Vencimiento 2026-09-11 se formatea como 11/09/2026', () => {
    expect(formatArcaDateForDisplay('2026-09-11')).toBe('11/09/2026')
    expect(formatArcaDateForDisplay('20260911')).toBe('11/09/2026')
  })

  // Test 3: Inmunidad total a desfases de zona horaria (UTC vs America/Argentina/Buenos_Aires)
  it('Test 3: El formateo de fechas no varía según la zona horaria del sistema', () => {
    const dates = [
      { input: '2026-09-01', expected: '01/09/2026' },
      { input: '2026-12-31', expected: '31/12/2026' },
      { input: '2027-01-01', expected: '01/01/2027' },
      { input: '20260911', expected: '11/09/2026' }
    ]

    for (const d of dates) {
      expect(formatArcaDateForDisplay(d.input)).toBe(d.expected)
    }
  })

  // Test 4: Validación de orden estricto Servicio Desde <= Hasta <= Vencimiento
  it('Test 4: Valida orden Servicio Desde <= Hasta <= Vencimiento', () => {
    // Válido
    expect(validateServiceDateOrder('2026-09-01', '2026-09-30', '2026-10-10').valid).toBe(true)
    expect(validateServiceDateOrder('2026-09-01', '2026-09-01', '2026-09-01').valid).toBe(true)

    // Inválido: Hasta anterior a Desde
    const invalidHasta = validateServiceDateOrder('2026-09-30', '2026-09-01', '2026-10-10')
    expect(invalidHasta.valid).toBe(false)
    expect(invalidHasta.error).toContain('no puede ser anterior a "Servicio Desde"')

    // Inválido: Vto anterior a Hasta
    const invalidVto = validateServiceDateOrder('2026-09-01', '2026-09-30', '2026-09-20')
    expect(invalidVto.valid).toBe(false)
    expect(invalidVto.error).toContain('no puede ser anterior a "Servicio Hasta"')
  })

  // Test 5: Vencimiento predeterminado nunca anterior a Servicio Hasta
  it('Test 5: getDefaultServiceDates garantiza vencimiento >= Servicio Hasta', () => {
    const refDate = new Date(2026, 8, 1) // 1 de Septiembre de 2026
    const def = getDefaultServiceDates(refDate)

    expect(def.FchServDesde).toBe('2026-09-01')
    expect(def.FchServHasta).toBe('2026-09-30')
    // El 30 de Septiembre es mayor que 1 + 10 días (11 de Septiembre), por lo que vto es al menos 30
    expect(def.FchVtoPago >= def.FchServHasta).toBe(true)
    expect(def.FchVtoPago).toBe('2026-09-30')
  })

  // Test 6: QR Factura C Nº 9 con tipoDocRec 80 y CUIT 20169381535
  it('Test 6: QR oficial para Factura C Nº 9 con fixture de regresión exacto', () => {
    const qrPayload = buildArcaQrPayload({
      fecha: '2026-09-01',
      cuit: '20412886128',
      ptoVta: 4,
      tipoCmp: 11,
      nroCmp: 9,
      importe: 65000,
      tipoDocRec: 80,
      nroDocRec: '20169381535',
      codAut: '86351008852564'
    })

    expect(qrPayload.json).toEqual({
      ver: 1,
      fecha: '2026-09-01',
      cuit: 20412886128,
      ptoVta: 4,
      tipoCmp: 11,
      nroCmp: 9,
      importe: 65000,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 80,
      nroDocRec: 20169381535,
      tipoCodAut: 'E',
      codAut: 86351008852564
    })

    expect(qrPayload.url).toContain('https://www.arca.gob.ar/fe/qr/?p=')

    // Decodificar Base64 para validar integridad exacta
    const base64Part = qrPayload.url.split('?p=')[1]
    const decoded = JSON.parse(Buffer.from(base64Part, 'base64').toString('utf-8'))
    expect(decoded.tipoDocRec).toBe(80)
    expect(decoded.nroDocRec).toBe(20169381535)
    expect(decoded.codAut).toBe(86351008852564)
  })

  // Test 7: QR generado localmente sin llamadas a servicios externos
  it('Test 7: generateArcaQrDataUrl produce Data URL válida de forma puramente local', async () => {
    const testUrl = 'https://www.arca.gob.ar/fe/qr/?p=eyJ2ZXIiOjF9'
    const dataUrl = await generateArcaQrDataUrl(testUrl)

    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(dataUrl).not.toContain('api.qrserver.com')
  })

  // Test 8: getCondicionIvaLabel mapea códigos correctamente
  it('Test 8: getCondicionIvaLabel mapea códigos oficiales de AFIP', () => {
    expect(getCondicionIvaLabel(1)).toBe('IVA Responsable Inscripto')
    expect(getCondicionIvaLabel(4)).toBe('IVA Sujeto Exento')
    expect(getCondicionIvaLabel(5)).toBe('Consumidor Final')
    expect(getCondicionIvaLabel(6)).toBe('Responsable Monotributo')
    expect(getCondicionIvaLabel(null)).toBe('Consumidor Final')
  })
})
