import { z } from 'zod'
import crypto from 'crypto'

export const ALLOWED_CBTE_TIPOS = [1, 2, 3, 6, 7, 8, 11, 12, 13] as const

/**
 * Valida si un string contiene un formato PEM de Certificado válido
 */
export function isValidCertificatePem(pem: string): boolean {
  if (!pem || typeof pem !== 'string') return false
  if (pem.includes('CERTIFICADO CONFIGURADO') || pem.includes('CLAVE PRIVADA CONFIGURADA')) {
    return false
  }
  const clean = pem.trim()
  return clean.includes('-----BEGIN CERTIFICATE-----') && clean.includes('-----END CERTIFICATE-----')
}

/**
 * Valida si un string contiene un formato PEM de Clave Privada válido
 */
export function isValidPrivateKeyPem(pem: string): boolean {
  if (!pem || typeof pem !== 'string') return false
  if (pem.includes('CERTIFICADO CONFIGURADO') || pem.includes('CLAVE PRIVADA CONFIGURADA')) {
    return false
  }
  const clean = pem.trim()
  const hasBegin = clean.includes('-----BEGIN PRIVATE KEY-----') || clean.includes('-----BEGIN RSA PRIVATE KEY-----')
  const hasEnd = clean.includes('-----END PRIVATE KEY-----') || clean.includes('-----END RSA PRIVATE KEY-----')
  return hasBegin && hasEnd
}

/**
 * Verifica que la clave privada corresponda al certificado digital firmando y verificando un mensaje.
 */
export function validateKeyPair(certPem: string, keyPem: string): boolean {
  try {
    if (!certPem || !keyPem) {
      return false
    }

    const testPayload = Buffer.from(`arca-validation-challenge-${Date.now()}`)

    // 1. Firmar payload con la clave privada
    const signer = crypto.createSign('SHA256')
    signer.update(testPayload)
    signer.end()
    const signature = signer.sign(keyPem)

    // 2. Extraer clave pública si es certificado X509 o verificar directamente
    let keyForVerification: string | crypto.KeyObject = certPem
    try {
      const x509 = new crypto.X509Certificate(certPem)
      keyForVerification = x509.publicKey
    } catch {
      keyForVerification = certPem
    }

    const verifier = crypto.createVerify('SHA256')
    verifier.update(testPayload)
    verifier.end()
    return verifier.verify(keyForVerification, signature)
  } catch {
    return false
  }
}

/**
 * Normaliza y valida una fecha en formato YYYYMMDD o YYYY-MM-DD
 */
function normalizeDateStr(d: string): string {
  return d.replace(/-/g, '').trim()
}

export const CreateInvoiceRequestSchema = z.object({
  budget_id: z.string().uuid({ message: 'El ID del presupuesto debe ser un UUID válido.' }),
  environment: z.enum(['homo', 'prod'], {
    message: 'El parámetro environment es obligatorio y debe ser "homo" o "prod".'
  }),
  cbteTipoOverride: z.number().int().refine(val => (ALLOWED_CBTE_TIPOS as readonly number[]).includes(val), {
    message: 'Tipo de comprobante no permitido. Solo se permiten Facturas (1, 6, 11), Notas de Débito (2, 7, 12) y Notas de Crédito (3, 8, 13).'
  }).optional(),
  isCreditNote: z.boolean().optional(),
  isDebitNote: z.boolean().optional(),
  is_total_cancellation: z.boolean().optional().default(true),
  invoice_original_id: z.string().uuid().optional(),
  correction_request_id: z.string().uuid({ message: 'El correction_request_id debe ser un UUID válido.' }).optional(),
  customAmount: z.number().positive({ message: 'El monto debe ser mayor a 0.' }).optional(),
  addIva: z.boolean().optional(),
  serviceDates: z.object({
    FchServDesde: z.string().regex(/^\d{4}-?\d{2}-?\d{2}$/, { message: 'Formato de fecha de servicio inválido' }),
    FchServHasta: z.string().regex(/^\d{4}-?\d{2}-?\d{2}$/, { message: 'Formato de fecha de servicio inválido' }),
    FchVtoPago: z.string().regex(/^\d{4}-?\d{2}-?\d{2}$/, { message: 'Formato de fecha de vencimiento inválido' }),
  }).optional().refine(dates => {
    if (!dates) return true
    const d1 = normalizeDateStr(dates.FchServDesde)
    const d2 = normalizeDateStr(dates.FchServHasta)
    const d3 = normalizeDateStr(dates.FchVtoPago)
    return d1 <= d2 && d2 <= d3
  }, {
    message: 'Las fechas del servicio deben respetar el orden cronológico: FchServDesde <= FchServHasta <= FchVtoPago.'
  })
}).refine(data => !(data.isCreditNote && data.isDebitNote), {
  message: 'Un comprobante no puede ser Nota de Crédito y Nota de Débito simultáneamente.'
}).refine(data => {
  if ((data.isCreditNote || data.isDebitNote) && !data.correction_request_id) {
    return false
  }
  return true
}, {
  message: 'correction_request_id es obligatorio para emitir Notas de Crédito o Débito.',
  path: ['correction_request_id']
}).refine(data => {
  if ((data.isCreditNote || data.isDebitNote) && !data.invoice_original_id) {
    return false
  }
  return true
}, {
  message: 'invoice_original_id es obligatorio para emitir Notas de Crédito o Débito.',
  path: ['invoice_original_id']
})

export const UpdateFiscalConfigSchema = z.object({
  cuit: z.string()
    .transform(val => val.replace(/[-_ ]/g, '').trim())
    .refine(val => /^\d{11}$/.test(val), {
      message: 'El CUIT debe tener exactamente 11 dígitos numéricos.'
    }),
  tipo_contribuyente: z.enum(['monotributo', 'responsable_inscripto', 'exento'], {
    message: 'La condición fiscal debe ser monotributo, responsable_inscripto o exento.'
  }),
  punto_venta: z.number().int().positive('El Punto de Venta debe ser un número entero mayor a 0.'),
  environment: z.enum(['homo', 'prod'], {
    message: 'El entorno debe ser homo o prod.'
  }),
  cert_content: z.string().optional(),
  key_content: z.string().optional()
}).superRefine((data, ctx) => {
  const hasCert = Boolean(data.cert_content && data.cert_content.trim().length > 0)
  const hasKey = Boolean(data.key_content && data.key_content.trim().length > 0)

  // Regla: Si se envía uno, es obligatorio enviar el otro
  if (hasCert && !hasKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Si se envía un nuevo certificado, también debe enviarse la clave privada correspondiente.',
      path: ['key_content']
    })
  }

  if (!hasCert && hasKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Si se envía una nueva clave privada, también debe enviarse el certificado correspondiente.',
      path: ['cert_content']
    })
  }

  if (hasCert && hasKey) {
    const cert = data.cert_content!
    const key = data.key_content!

    if (!isValidCertificatePem(cert)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El certificado no posee un formato PEM válido (BEGIN CERTIFICATE ... END CERTIFICATE).',
        path: ['cert_content']
      })
    }

    if (!isValidPrivateKeyPem(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La clave privada no posee un formato PEM válido (BEGIN PRIVATE KEY / RSA PRIVATE KEY).',
        path: ['key_content']
      })
    }

    if (isValidCertificatePem(cert) && isValidPrivateKeyPem(key)) {
      const match = validateKeyPair(cert, key)
      if (!match) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La clave privada no corresponde al certificado digital provisto.',
          path: ['key_content']
        })
      }
    }
  }
})
