import QRCode from 'qrcode'

export interface ArcaQrParams {
  fecha: string
  cuit: string | number
  ptoVta: number
  tipoCmp: number
  nroCmp: number
  importe: number
  tipoDocRec?: number | null
  nroDocRec?: string | number | null
  codAut: string | number
}

/**
 * Normaliza una fecha en formato YYYYMMDD o YYYY-MM-DD a YYYY-MM-DD sin usar Date()
 */
export function normalizeArcaDate(value?: string | null): string | null {
  if (!value) return null

  const digits = String(value).replace(/\D/g, '')
  if (!/^\d{8}$/.test(digits)) {
    throw new Error(`Fecha ARCA inválida: ${value}`)
  }

  const yyyy = digits.slice(0, 4)
  const mm = digits.slice(4, 6)
  const dd = digits.slice(6, 8)

  return `${yyyy}-${mm}-${dd}`
}

/**
 * Formatea una fecha YYYY-MM-DD o YYYYMMDD para visualización como DD/MM/YYYY sin corrimiento de zona horaria
 */
export function formatArcaDateForDisplay(value?: string | null): string {
  if (!value) return ''

  const digits = String(value).replace(/\D/g, '')
  if (digits.length !== 8) return String(value)

  const yyyy = digits.slice(0, 4)
  const mm = digits.slice(4, 6)
  const dd = digits.slice(6, 8)

  return `${dd}/${mm}/${yyyy}`
}

/**
 * Devuelve las fechas de servicio predeterminadas respetando:
 * Vencimiento = max(fecha actual + 10 días, fecha servicio hasta)
 */
export function getDefaultServiceDates(referenceDate: Date = new Date()): {
  FchServDesde: string
  FchServHasta: string
  FchVtoPago: string
} {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth() // 0-indexed

  const yyyyStr = String(year)
  const mmStr = String(month + 1).padStart(2, '0')

  // Primer día del mes actual
  const desde = `${yyyyStr}-${mmStr}-01`

  // Último día del mes actual
  const lastDay = new Date(year, month + 1, 0).getDate()
  const hasta = `${yyyyStr}-${mmStr}-${String(lastDay).padStart(2, '0')}`

  // Fecha actual + 10 días
  const in10Days = new Date(referenceDate.getTime() + 10 * 24 * 60 * 60 * 1000)
  const in10DaysStr = `${in10Days.getFullYear()}-${String(in10Days.getMonth() + 1).padStart(2, '0')}-${String(in10Days.getDate()).padStart(2, '0')}`

  // Vto = max(in10Days, hasta)
  const vto = in10DaysStr > hasta ? in10DaysStr : hasta

  return {
    FchServDesde: desde,
    FchServHasta: hasta,
    FchVtoPago: vto
  }
}

/**
 * Valida que las fechas de servicio cumplan estrictamente: desde <= hasta <= vto
 */
export function validateServiceDateOrder(
  desde?: string | null,
  hasta?: string | null,
  vto?: string | null
): { valid: boolean; error?: string } {
  if (!desde || !hasta || !vto) {
    return { valid: true }
  }

  const d1 = normalizeArcaDate(desde)
  const d2 = normalizeArcaDate(hasta)
  const d3 = normalizeArcaDate(vto)

  if (!d1 || !d2 || !d3) {
    return { valid: false, error: 'Formato de fecha inválido.' }
  }

  if (d1 > d2) {
    return { valid: false, error: 'La fecha "Servicio Hasta" no puede ser anterior a "Servicio Desde".' }
  }

  if (d2 > d3) {
    return { valid: false, error: 'La fecha de "Vencimiento para el Pago" no puede ser anterior a "Servicio Hasta".' }
  }

  return { valid: true }
}

/**
 * Construye el objeto JSON oficial del QR de ARCA y la URL de constatación
 */
export function buildArcaQrPayload(params: ArcaQrParams): {
  json: Record<string, unknown>
  base64: string
  url: string
} {
  const normFecha = normalizeArcaDate(params.fecha)
  if (!normFecha) {
    throw new Error('Fecha fiscal requerida para generar el QR oficial.')
  }

  const cuitNum = Number(String(params.cuit).replace(/\D/g, ''))
  const ptoVtaNum = Number(params.ptoVta)
  const tipoCmpNum = Number(params.tipoCmp)
  const nroCmpNum = Number(params.nroCmp)
  const importeNum = Number(Math.abs(Number(params.importe)).toFixed(2))

  const tipoDocRecNum = params.tipoDocRec != null ? Number(params.tipoDocRec) : 99
  const nroDocRecDigits = params.nroDocRec != null ? String(params.nroDocRec).replace(/\D/g, '') : '0'
  const nroDocRecNum = nroDocRecDigits ? Number(nroDocRecDigits) : 0

  const codAutDigits = String(params.codAut).replace(/\D/g, '')
  const codAutNum = Number(codAutDigits)

  const payload: Record<string, unknown> = {
    ver: 1,
    fecha: normFecha,
    cuit: cuitNum,
    ptoVta: ptoVtaNum,
    tipoCmp: tipoCmpNum,
    nroCmp: nroCmpNum,
    importe: importeNum,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: tipoDocRecNum,
    nroDocRec: nroDocRecNum,
    tipoCodAut: 'E',
    codAut: codAutNum
  }

  const jsonStr = JSON.stringify(payload)
  const base64 = typeof Buffer !== 'undefined'
    ? Buffer.from(jsonStr).toString('base64')
    : btoa(unescape(encodeURIComponent(jsonStr)))

  const url = `https://www.arca.gob.ar/fe/qr/?p=${base64}`

  return {
    json: payload,
    base64,
    url
  }
}

/**
 * Genera el código QR en Base64 Data URL localmente sin dependencias externas
 */
export async function generateArcaQrDataUrl(qrUrl: string): Promise<string> {
  return QRCode.toDataURL(qrUrl, {
    margin: 1,
    width: 256,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  })
}

/**
 * Devuelve la etiqueta descriptiva de la condición IVA del receptor a partir del código AFIP
 */
export function getCondicionIvaLabel(codigo?: number | null): string {
  switch (codigo) {
    case 1:
      return 'IVA Responsable Inscripto'
    case 4:
      return 'IVA Sujeto Exento'
    case 5:
      return 'Consumidor Final'
    case 6:
      return 'Responsable Monotributo'
    default:
      return 'Consumidor Final'
  }
}
