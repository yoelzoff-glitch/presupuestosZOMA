import crypto from 'crypto'
import { NextRequest } from 'next/server'

function safeCompare(a: string, b: string) {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)

  if (bufferA.length !== bufferB.length) return false

  return crypto.timingSafeEqual(bufferA, bufferB)
}

export function verifyMercadoPagoWebhookSignature(req: NextRequest) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()

  if (!secret) {
    console.error('❌ No se encontró MERCADOPAGO_WEBHOOK_SECRET');
    return false
  }

  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')

  console.log('🔍 Debug Signature - Headers:', { 'x-signature': xSignature, 'x-request-id': xRequestId });

  if (!xSignature) {
    console.error('❌ Falta header x-signature');
    return false
  }

  let ts = ''
  let receivedHash = ''

  const parts = xSignature.split(',')

  for (const part of parts) {
    const [key, value] = part.split('=')

    if (key?.trim() === 'ts') ts = value?.trim() || ''
    if (key?.trim() === 'v1') receivedHash = value?.trim() || ''
  }

  if (!ts || !receivedHash) {
    console.error('❌ Faltan componentes de firma (ts o v1)', { ts, receivedHash });
    return false;
  }

  const url = new URL(req.url)

  const dataId =
    url.searchParams.get('data.id') ||
    url.searchParams.get('id') ||
    ''

  let manifest = ''

  if (dataId) {
    manifest += `id:${dataId};`
  }

  if (xRequestId) {
    manifest += `request-id:${xRequestId};`
  }

  manifest += `ts:${ts};`

  const generatedHash = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex')

  console.log('🔍 Debug Signature - Secret (last 4):', secret.slice(-4));
  console.log('🔍 Debug Signature - Manifest:', manifest);
  console.log('🔍 Debug Signature - Generated Hash:', generatedHash);
  console.log('🔍 Debug Signature - Received Hash:', receivedHash);

  const timestamp = Number(ts)
  const timestampMs =
    ts.length === 10 ? timestamp * 1000 : timestamp

  const now = Date.now()
  const toleranceMs = 10 * 60 * 1000

  if (
    Number.isFinite(timestampMs) &&
    Math.abs(now - timestampMs) > toleranceMs
  ) {
    console.error('Webhook Mercado Pago fuera de tolerancia')
    return false
  }

  return safeCompare(generatedHash, receivedHash)
}