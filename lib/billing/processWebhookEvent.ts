import { getMercadoPagoBillingConfig } from './config'
import {
  getAuthorizedPayment,
  getPayment,
  getPreapproval,
  type MercadoPagoAuthorizedPayment,
  type MercadoPagoPayment,
  type MercadoPagoPreapproval,
} from './mercadopago'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

type ProcessInput = {
  type: string
  resourceId: string
  eventKey: string
  payload: Record<string, unknown>
}

function parseDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function assertMercadoPagoOwnership(resource: {
  application_id?: string | number
  collector_id?: string | number
}) {
  const config = getMercadoPagoBillingConfig()
  if (
    config.applicationId &&
    resource.application_id != null &&
    String(resource.application_id) !== config.applicationId
  ) {
    throw new Error('Mercado Pago application mismatch')
  }
  if (
    config.collectorId &&
    resource.collector_id != null &&
    String(resource.collector_id) !== config.collectorId
  ) {
    throw new Error('Mercado Pago collector mismatch')
  }
}

function onboardingIdFromReference(reference?: string) {
  const prefix = 'zoma_onboarding:'
  return reference?.startsWith(prefix) ? reference.slice(prefix.length) : null
}

function paymentPreapprovalId(payment: MercadoPagoPayment) {
  if (payment.preapproval_id) return payment.preapproval_id
  const metadataValue = payment.metadata?.preapproval_id
  if (typeof metadataValue === 'string') return metadataValue
  const transactionValue = payment.point_of_interaction?.transaction_data?.subscription_id
  return typeof transactionValue === 'string' ? transactionValue : null
}

function approvedPaymentStatus(status: string) {
  return ['approved', 'processed'].includes(status)
}

function rejectedPaymentStatus(status: string) {
  return ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status)
}

async function applyBillingEvent(input: {
  companyId: string
  eventKey: string
  eventType: string
  newStatus: 'trial' | 'active' | 'past_due' | 'cancelled' | 'suspended'
  preapprovalId?: string | null
  paymentId?: string | null
  paymentStatus?: string | null
  statusDetail?: string | null
  amount?: number | null
  currency?: string | null
  nextChargeAt?: string | null
  occurredAt?: string | null
  payload: Record<string, unknown>
}) {
  const admin = createSupabaseAdminClient()
  const { error } = await admin.rpc('apply_saas_billing_event', {
    p_company_id: input.companyId,
    p_event_key: input.eventKey,
    p_event_type: input.eventType,
    p_new_status: input.newStatus,
    p_mp_preapproval_id: input.preapprovalId || null,
    p_mp_payment_id: input.paymentId || null,
    p_payment_status: input.paymentStatus || null,
    p_status_detail: input.statusDetail || null,
    p_amount: input.amount ?? null,
    p_currency_id: input.currency || null,
    p_next_charge_at: input.nextChargeAt || null,
    p_occurred_at: input.occurredAt || new Date().toISOString(),
    p_payload: input.payload,
  })
  if (error) throw new Error(error.message)
}

async function processPreapproval(
  preapproval: MercadoPagoPreapproval,
  eventKey: string,
  payload: Record<string, unknown>
) {
  assertMercadoPagoOwnership(preapproval)
  const admin = createSupabaseAdminClient()
  const onboardingId = onboardingIdFromReference(preapproval.external_reference)
  let query = admin.from('onboarding_sessions').select('*')
  query = onboardingId
    ? query.eq('id', onboardingId)
    : query.eq('mp_preapproval_id', preapproval.id)

  const { data: session, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  if (!session) return { ignored: true, reason: 'not_zoma_billing' }

  const status = preapproval.status.toLowerCase()
  const trialStart = session.trial_started_at || preapproval.date_created || new Date().toISOString()
  const fallbackEnd = new Date(trialStart)
  fallbackEnd.setUTCDate(fallbackEnd.getUTCDate() + 14)
  const trialEnd = preapproval.next_payment_date || session.trial_ends_at || fallbackEnd.toISOString()
  const sessionStatus = status === 'authorized'
    ? 'authorized'
    : ['cancelled', 'canceled', 'paused'].includes(status)
      ? 'cancelled'
      : 'pending_authorization'

  const { error: updateError } = await admin
    .from('onboarding_sessions')
    .update({
      status: session.company_id ? session.status : sessionStatus,
      mp_preapproval_id: preapproval.id,
      mp_payer_id: preapproval.payer_id ? String(preapproval.payer_id) : session.mp_payer_id,
      mp_external_reference: preapproval.external_reference || session.mp_external_reference,
      mp_init_point: preapproval.init_point || session.mp_init_point,
      mp_status: status,
      trial_started_at: trialStart,
      trial_ends_at: trialEnd,
      next_payment_at: preapproval.next_payment_date || session.next_payment_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id)
  if (updateError) throw new Error(updateError.message)

  let companyId = session.company_id as string | null
  if (status === 'authorized' && !companyId) {
    const { data, error: provisionError } = await admin.rpc('provision_trial_tenant', {
      p_onboarding_session_id: session.id,
      p_auth_user_id: session.auth_user_id,
    })
    if (provisionError) throw new Error(provisionError.message)
    companyId = (data as { company_id?: string } | null)?.company_id || null
  }

  if (!companyId) return { ignored: false, provisioned: false }

  if (status === 'authorized') {
    await applyBillingEvent({
      companyId,
      eventKey,
      eventType: 'subscription_authorized',
      newStatus: new Date(trialEnd).getTime() > Date.now() ? 'trial' : 'active',
      preapprovalId: preapproval.id,
      paymentStatus: status,
      nextChargeAt: preapproval.next_payment_date || null,
      occurredAt: parseDate(preapproval.last_modified || preapproval.date_created),
      payload,
    })
  } else if (['cancelled', 'canceled', 'paused'].includes(status)) {
    const trialIsActive = new Date(trialEnd).getTime() > Date.now()
    await applyBillingEvent({
      companyId,
      eventKey,
      eventType: trialIsActive
        ? 'subscription_cancelled_at_period_end'
        : 'subscription_cancelled',
      newStatus: trialIsActive ? 'trial' : 'cancelled',
      preapprovalId: preapproval.id,
      paymentStatus: status,
      nextChargeAt: preapproval.next_payment_date || null,
      occurredAt: parseDate(preapproval.last_modified),
      payload,
    })
  }

  return { ignored: false, provisioned: true, companyId }
}

async function companyForPreapproval(preapprovalId: string | null) {
  if (!preapprovalId) return null
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('companies')
    .select('id')
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle()
  return data?.id || null
}

async function processPayment(
  payment: MercadoPagoPayment,
  eventKey: string,
  payload: Record<string, unknown>
) {
  const preapprovalId = paymentPreapprovalId(payment)
  const onboardingId = onboardingIdFromReference(payment.external_reference)
  const admin = createSupabaseAdminClient()
  let companyId = await companyForPreapproval(preapprovalId)

  if (!companyId && onboardingId) {
    const { data } = await admin
      .from('onboarding_sessions')
      .select('company_id')
      .eq('id', onboardingId)
      .maybeSingle()
    companyId = data?.company_id || null
  }
  if (!companyId) return { ignored: true, reason: 'not_zoma_billing' }

  const status = payment.status.toLowerCase()
  if (!approvedPaymentStatus(status) && !rejectedPaymentStatus(status)) {
    return { ignored: false, pending: true, companyId }
  }

  await applyBillingEvent({
    companyId,
    eventKey,
    eventType: 'subscription_payment',
    newStatus: approvedPaymentStatus(status) ? 'active' : 'past_due',
    preapprovalId,
    paymentId: String(payment.id),
    paymentStatus: status,
    statusDetail: payment.status_detail || null,
    amount: payment.transaction_amount ?? null,
    currency: payment.currency_id || null,
    occurredAt: parseDate(payment.date_approved || payment.date_created),
    payload,
  })
  return { ignored: false, companyId, paymentStatus: status }
}

async function processAuthorizedPayment(
  payment: MercadoPagoAuthorizedPayment,
  eventKey: string,
  payload: Record<string, unknown>
) {
  const companyId = await companyForPreapproval(payment.preapproval_id || null)
  if (!companyId) return { ignored: true, reason: 'not_zoma_billing' }

  const status = (payment.payment?.status || payment.status).toLowerCase()
  if (!approvedPaymentStatus(status) && !rejectedPaymentStatus(status)) {
    return { ignored: false, pending: true, companyId }
  }

  await applyBillingEvent({
    companyId,
    eventKey,
    eventType: 'subscription_authorized_payment',
    newStatus: approvedPaymentStatus(status) ? 'active' : 'past_due',
    preapprovalId: payment.preapproval_id || null,
    paymentId: payment.payment?.id ? String(payment.payment.id) : String(payment.id),
    paymentStatus: status,
    statusDetail: payment.status_detail || null,
    amount: payment.transaction_amount ?? null,
    currency: payment.currency_id || null,
    occurredAt: parseDate(payment.debit_date || payment.date_created),
    payload,
  })
  return { ignored: false, companyId, paymentStatus: status }
}

export async function processBillingResource(input: ProcessInput) {
  if (input.type === 'subscription_preapproval') {
    return processPreapproval(await getPreapproval(input.resourceId), input.eventKey, input.payload)
  }
  if (input.type === 'payment') {
    return processPayment(await getPayment(input.resourceId), input.eventKey, input.payload)
  }
  if (input.type === 'subscription_authorized_payment') {
    return processAuthorizedPayment(
      await getAuthorizedPayment(input.resourceId),
      input.eventKey,
      input.payload
    )
  }
  return { ignored: true, reason: 'unsupported_event_type' }
}

export async function reconcilePreapproval(preapprovalId: string, eventKey: string) {
  return processPreapproval(
    await getPreapproval(preapprovalId),
    eventKey,
    { source: 'reconciliation' }
  )
}
