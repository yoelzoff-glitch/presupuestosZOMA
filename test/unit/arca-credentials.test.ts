import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encryptText, decryptText, getEncryptionKey, EncryptedPayload } from '@/lib/arca/encryption'
import { 
  UpdateFiscalConfigSchema, 
  isValidCertificatePem, 
  isValidPrivateKeyPem, 
  validateKeyPair 
} from '@/lib/arca/validations'
import { TEST_ENCRYPTION_KEY_BASE64 } from '../helpers/crypto-fixtures'
import crypto from 'crypto'

describe('Unit Tests: ARCA Credentials & Cryptography', () => {
  const originalEnv = process.env.ARCA_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ARCA_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY_BASE64
  })

  afterEach(() => {
    process.env.ARCA_ENCRYPTION_KEY = originalEnv
  })

  it('Unit 1: Guardar punto de venta sin enviar PEM conserva las credenciales (validación de schema opcional)', () => {
    const payload = {
      cuit: '20123456789',
      punto_venta: 5,
      tipo_contribuyente: 'monotributo',
      environment: 'homo'
      // cert_content y key_content omitidos
    }

    const result = UpdateFiscalConfigSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cert_content).toBeUndefined()
      expect(result.data.key_content).toBeUndefined()
      expect(result.data.punto_venta).toBe(5)
    }
  })

  it('Unit 2: Un placeholder ("CERTIFICADO CONFIGURADO" / "CLAVE PRIVADA CONFIGURADA") es rechazado', () => {
    const invalidCert = '•••••••• CERTIFICADO CONFIGURADO ••••••••'
    const invalidKey = '•••••••• CLAVE PRIVADA CONFIGURADA ••••••••'

    expect(isValidCertificatePem(invalidCert)).toBe(false)
    expect(isValidPrivateKeyPem(invalidKey)).toBe(false)

    const payload = {
      cuit: '20123456789',
      punto_venta: 5,
      tipo_contribuyente: 'monotributo',
      environment: 'homo',
      cert_content: invalidCert,
      key_content: invalidKey
    }

    const result = UpdateFiscalConfigSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('Unit 3: CUIT inválido (distinto a 11 dígitos numéricos) es rechazado', () => {
    const invalidCuits = ['123', '20-12345678-999', 'abcdefghijk', '2012345678', '']

    invalidCuits.forEach(cuit => {
      const result = UpdateFiscalConfigSchema.safeParse({
        cuit,
        punto_venta: 1,
        tipo_contribuyente: 'monotributo',
        environment: 'homo'
      })
      expect(result.success).toBe(false)
    })

    const validResult = UpdateFiscalConfigSchema.safeParse({
      cuit: '20-12345678-9',
      punto_venta: 1,
      tipo_contribuyente: 'monotributo',
      environment: 'homo'
    })
    expect(validResult.success).toBe(true)
    if (validResult.success) {
      expect(validResult.data.cuit).toBe('20123456789')
    }
  })

  it('Unit 4: Formato PEM inválido es rechazado', () => {
    expect(isValidCertificatePem('NOT_A_PEM_CERT')).toBe(false)
    expect(isValidPrivateKeyPem('NOT_A_PEM_KEY')).toBe(false)
    expect(isValidCertificatePem('-----BEGIN CERTIFICATE-----\nONLY_START')).toBe(false)
  })

  it('Unit 5: Certificado y clave incompatibles son rechazados', () => {
    // Generar dos pares de claves distintos
    const pair1 = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })
    const pair2 = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })

    // Clave 2 contra Certificado 1 debe fallar
    const matches = validateKeyPair(pair1.publicKey, pair2.privateKey)
    expect(matches).toBe(false)

    // Clave 1 contra Certificado 1 debe ser true
    const validMatches = validateKeyPair(pair1.publicKey, pair1.privateKey)
    expect(validMatches).toBe(true)
  })

  it('Unit 6: ARCA_ENCRYPTION_KEY ausente o inválida provoca error inmediato', () => {
    delete process.env.ARCA_ENCRYPTION_KEY
    expect(() => getEncryptionKey()).toThrow(/ARCA_ENCRYPTION_KEY no está configurada/)

    // Clave con longitud incorrecta (ej: 16 bytes en lugar de 32)
    process.env.ARCA_ENCRYPTION_KEY = Buffer.from('1234567890123456').toString('base64')
    expect(() => getEncryptionKey()).toThrow(/debe tener exactamente 32 bytes/)
  })

  it('Unit 7: Un payload alterado o manipulado falla al descifrarse con autenticación AES-256-GCM', () => {
    process.env.ARCA_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY_BASE64
    const originalText = 'MI_SECRETO_PEM_MUY_CONFIDENCIAL'
    const encrypted = encryptText(originalText)

    // Modificar un byte del ciphertext
    const tamperedPayload: EncryptedPayload = {
      ...encrypted,
      ciphertext: encrypted.ciphertext.substring(0, encrypted.ciphertext.length - 2) + 'aa'
    }

    expect(() => decryptText(tamperedPayload)).toThrow()

    // Payload original descifra correctamente
    const decrypted = decryptText(encrypted)
    expect(decrypted).toBe(originalText)
  })
})
