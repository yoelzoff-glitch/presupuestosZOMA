import { getMercadoPagoBillingConfig, type BillingPlanConfig } from './config'

const MERCADO_PAGO_API = 'https://api.mercadopago.com'

type MercadoPagoErrorBody = {
  message?: string
  error?: string
  status?: number
  cause?: Array<{ code?: string; description?: string }>
}

export type MercadoPagoPreapproval = {
  id: string
  application_id?: number | string
  collector_id?: number | string
  payer_id?: number | string
  payer_email?: string
  external_reference?: string
  init_point?: string
  status: string
  next_payment_date?: string
  date_created?: string
  last_modified?: string
  auto_recurring?: {
    frequency?: number
    frequency_type?: string
    transaction_amount?: number | string
    currency_id?: string
    start_date?: string
    free_trial?: {
      frequency?: number
      frequency_type?: string
    }
  }
}

export type MercadoPagoPayment = {
  id: number | string
  status: string
  status_detail?: string
  external_reference?: string
  transaction_amount?: number
  currency_id?: string
  date_approved?: string
  date_created?: string
  preapproval_id?: string
  metadata?: Record<string, unknown>
  point_of_interaction?: {
    transaction_data?: Record<string, unknown>
  }
}

export type MercadoPagoAuthorizedPayment = {
  id: number | string
  status: string
  status_detail?: string
  preapproval_id?: string
  payment?: { id?: number | string; status?: string }
  transaction_amount?: number
  currency_id?: string
  debit_date?: string
  date_created?: string
}

async function mercadoPagoRequest<T>(
  path: string,
  init: RequestInit = {},
  idempotencyKey?: string
): Promise<T> {
  const { accessToken } = getMercadoPagoBillingConfig()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('Content-Type', 'application/json')
  if (idempotencyKey) headers.set('X-Idempotency-Key', idempotencyKey)

  const response = await fetch(`${MERCADO_PAGO_API}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  })

  const body = (await response.json().catch(() => ({}))) as T & MercadoPagoErrorBody

  if (!response.ok) {
    const cause = body.cause?.[0]?.description
    throw new Error(
      cause || body.message || body.error || `Mercado Pago returned ${response.status}`
    )
  }

  return body
}

export async function createTrialPreapproval(input: {
  email: string
  externalReference: string
  backUrl: string
  notificationUrl: string
  plan: BillingPlanConfig
  idempotencyKey: string
}) {
  const body: Record<string, unknown> = {
    reason: `ZOMA ERP - ${input.plan.name}`,
    external_reference: input.externalReference,
    payer_email: input.email,
    back_url: input.backUrl,
    notification_url: input.notificationUrl,
  }

  if (input.plan.mercadoPagoPlanId) {
    body.preapproval_plan_id = input.plan.mercadoPagoPlanId
  } else {
    body.auto_recurring = {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: input.plan.amount,
      currency_id: input.plan.currency,
      free_trial: {
        frequency: 14,
        frequency_type: 'days',
      },
    }
  }

  return mercadoPagoRequest<MercadoPagoPreapproval>(
    '/preapproval',
    { method: 'POST', body: JSON.stringify(body) },
    input.idempotencyKey
  )
}

export function getPreapproval(preapprovalId: string) {
  return mercadoPagoRequest<MercadoPagoPreapproval>(
    `/preapproval/${encodeURIComponent(preapprovalId)}`
  )
}

export function getPayment(paymentId: string) {
  return mercadoPagoRequest<MercadoPagoPayment>(
    `/v1/payments/${encodeURIComponent(paymentId)}`
  )
}

export function getAuthorizedPayment(authorizedPaymentId: string) {
  return mercadoPagoRequest<MercadoPagoAuthorizedPayment>(
    `/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`
  )
}

export function cancelPreapproval(preapprovalId: string) {
  return mercadoPagoRequest<MercadoPagoPreapproval>(
    `/preapproval/${encodeURIComponent(preapprovalId)}`,
    { method: 'PUT', body: JSON.stringify({ status: 'canceled' }) }
  )
}
