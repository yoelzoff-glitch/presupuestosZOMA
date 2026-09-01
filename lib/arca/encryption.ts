import crypto from 'crypto'

export interface EncryptedPayload {
  ciphertext: string
  iv: string
  tag: string
}

/**
 * Obtiene y valida la clave criptográfica desde ARCA_ENCRYPTION_KEY.
 * Requiere exactamente 32 bytes decodificados desde Base64.
 * Prohibido el uso de fallbacks inseguros o Service Role Keys.
 */
export function getEncryptionKey(): Buffer {
  const envKey = process.env.ARCA_ENCRYPTION_KEY
  if (!envKey) {
    throw new Error(
      'ARCA_ENCRYPTION_KEY no está configurada. Configure una clave Base64 de 32 bytes en las variables de entorno.'
    )
  }

  const keyBuffer = Buffer.from(envKey, 'base64')
  if (keyBuffer.length !== 32) {
    throw new Error(
      `ARCA_ENCRYPTION_KEY inválida: debe tener exactamente 32 bytes (256 bits). Longitud recibida: ${keyBuffer.length} bytes.`
    )
  }

  return keyBuffer
}

/**
 * Cifra un texto en plano utilizando AES-256-GCM.
 */
export function encryptText(plainText: string): EncryptedPayload {
  if (!plainText) {
    return { ciphertext: '', iv: '', tag: '' }
  }

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12) // 12 bytes IV estándar recomendado para AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag: tag
  }
}

/**
 * Descifra un payload cifrado con AES-256-GCM.
 * Lanza un error si el payload fue manipulado o la clave es incorrecta.
 */
export function decryptText(payload: EncryptedPayload): string {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.tag) {
    return ''
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(payload.iv, 'hex')
  const tag = Buffer.from(payload.tag, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)

  decipher.setAuthTag(tag)

  let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Calcula el fingerprint SHA-256 del certificado PEM
 */
export function getCertificateFingerprint(certPem: string): string {
  if (!certPem) return ''
  const cleanPem = certPem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '')
  const certBuffer = Buffer.from(cleanPem, 'base64')
  return crypto.createHash('sha256').update(certBuffer).digest('hex')
}
