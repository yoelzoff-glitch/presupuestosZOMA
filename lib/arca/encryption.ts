import crypto from 'crypto'

export interface EncryptedPayload {
  ciphertext: string
  iv: string
  tag: string
}

function getSecretKey(): Buffer {
  const secret = process.env.ARCA_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'zoma-arca-fallback-key-32-chars!'
  // Asegurar siempre exactamente 32 bytes usando SHA-256
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Cifra un texto en plano utilizando AES-256-GCM
 */
export function encryptText(plainText: string): EncryptedPayload {
  if (!plainText) {
    return { ciphertext: '', iv: '', tag: '' }
  }

  const key = getSecretKey()
  const iv = crypto.randomBytes(12) // 12 bytes IV estándar para GCM
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
 * Descifra un payload cifrado con AES-256-GCM
 */
export function decryptText(payload: EncryptedPayload): string {
  if (!payload.ciphertext || !payload.iv || !payload.tag) {
    return ''
  }

  const key = getSecretKey()
  const iv = Buffer.from(payload.iv, 'hex')
  const tag = Buffer.from(payload.tag, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)

  decipher.setAuthTag(tag)

  let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
