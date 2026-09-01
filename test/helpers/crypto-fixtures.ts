import crypto from 'crypto'

/**
 * Genera un par de certificado autofirmado / clave privada PEM válido en memoria para testing
 */
export function generateTestKeyPair(): { certPem: string; keyPem: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })

  // Para tests que requieran estructura -----BEGIN CERTIFICATE-----, construimos un contenedor PEM válido
  const fakeCertBody = Buffer.from(publicKey.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, ''), 'utf-8').toString('base64')
  const certPem = `-----BEGIN CERTIFICATE-----\n${fakeCertBody.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`

  return {
    certPem,
    keyPem: privateKey
  }
}

/**
 * Clave fija de prueba de 32 bytes en Base64
 */
export const TEST_ENCRYPTION_KEY_BASE64 = Buffer.from('12345678901234567890123456789012').toString('base64')
