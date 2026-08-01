export type BillingPlan = 'base' | 'pro'

export type BillingPlanConfig = {
  id: BillingPlan
  name: string
  amount: number
  currency: 'ARS'
  mercadoPagoPlanId?: string
}

function positiveAmount(value: string | undefined, fallback: number) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : fallback
}

export function getBillingPlan(plan: BillingPlan): BillingPlanConfig {
  if (plan === 'base') {
    return {
      id: 'base',
      name: 'Plan BASE',
      amount: positiveAmount(process.env.MERCADOPAGO_PLAN_BASE_AMOUNT, 80000),
      currency: 'ARS',
      mercadoPagoPlanId:
        process.env.MERCADOPAGO_PREAPPROVAL_PLAN_BASE_ID?.trim() || undefined,
    }
  }

  return {
    id: 'pro',
    name: 'Plan PRO',
    amount: positiveAmount(process.env.MERCADOPAGO_PLAN_PRO_AMOUNT, 110000),
    currency: 'ARS',
    mercadoPagoPlanId:
      process.env.MERCADOPAGO_PREAPPROVAL_PLAN_PRO_ID?.trim() || undefined,
  }
}

export function getMercadoPagoBillingConfig() {
  const accessToken = process.env.MERCADOPAGO_BILLING_ACCESS_TOKEN?.trim()

  if (!accessToken) {
    throw new Error('MERCADOPAGO_BILLING_ACCESS_TOKEN is not configured')
  }

  return {
    accessToken,
    applicationId: process.env.MERCADOPAGO_BILLING_APPLICATION_ID?.trim(),
    collectorId: process.env.MERCADOPAGO_BILLING_COLLECTOR_ID?.trim(),
  }
}

export function getPublicAppUrl(requestUrl?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (requestUrl) return new URL(requestUrl).origin
  throw new Error('NEXT_PUBLIC_APP_URL is not configured')
}
