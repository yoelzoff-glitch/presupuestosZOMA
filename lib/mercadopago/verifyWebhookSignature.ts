import crypto from 'crypto'
import type { NextRequest } from 'next/server'

type SignatureOptions = {
  secret?: string
  toleranceMs?: number
}

function safeCompareHex(left: string, right: string) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false

  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')
  if (leftBuffer.length !== rightBuffer.length) return false

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifyMercadoPagoWebhookSignature(
  request: NextRequest,
  options: SignatureOptions = {}
) {
  const secret =
    options.secret?.trim() || process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()

  if (!secret) return false

  const signatureHeader = request.headers.get('x-signature')
  const requestId = request.headers.get('x-request-id')
  if (!signatureHeader) return false

  const signatureParts = new Map(
    signatureHeader.split(',').map((part) => {
      const separator = part.indexOf('=')
      if (separator === -1) return [part.trim(), '']
      return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
    })
  )

  const timestamp = signatureParts.get('ts') || ''
  const receivedHash = signatureParts.get('v1') || ''
  if (!timestamp || !receivedHash) return false

  const timestampNumber = Number(timestamp)
  const timestampMs = timestamp.length <= 10 ? timestampNumber * 1000 : timestampNumber
  const toleranceMs = options.toleranceMs ?? 10 * 60 * 1000

  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > toleranceMs
  ) {
    return false
  }

  const url = new URL(request.url)
  const dataId = (
    url.searchParams.get('data.id') ||
    url.searchParams.get('id') ||
    ''
  ).toLowerCase()

  if (!dataId) return false

  let manifest = `id:${dataId};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${timestamp};`

  const generatedHash = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex')

  return safeCompareHex(generatedHash, receivedHash)
}
