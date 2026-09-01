import { SupabaseClient } from '@supabase/supabase-js'
import { Arca } from '@arcasdk/core'

export interface InvoiceAttemptRecord {
  id: string
  company_id: string
  budget_id: string
  environment: 'homo' | 'prod'
  operation_type: 'invoice' | 'credit_note' | 'debit_note'
  idempotency_key: string
  status: 'pending' | 'processing' | 'authorized_pending_persistence' | 'persisted' | 'rejected' | 'reconciliation_required'
  punto_venta: number
  comprobante_tipo: number
  comprobante_numero: number | null
  request_payload: Record<string, unknown>
  arca_response: Record<string, unknown> | null
  cae: string | null
  cae_expires_at: string | null
  error_code: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

// In-memory mutex map local como optimización secundaria en el mismo proceso Node
const localEmissionLocks = new Set<string>()

export function getEmissionLockKey(companyId: string, env: string, ptoVta: number, cbteTipo: number): string {
  return `${companyId}:${env}:${ptoVta}:${cbteTipo}`
}

/**
 * Adquiere un lock de emisión distribuido en PostgreSQL (tabla public.arca_emission_locks)
 */
export async function acquireEmissionLockDistributed(
  supabaseAdmin: SupabaseClient,
  lockKey: string,
  lockToken: string,
  leaseSeconds = 120
): Promise<boolean> {
  // 1. Verificar lock local en memoria
  if (localEmissionLocks.has(lockKey)) {
    return false
  }

  // 2. Adquirir lock distribuido vía RPC atómica
  const { data, error } = await supabaseAdmin.rpc('claim_arca_emission_lock', {
    p_lock_key: lockKey,
    p_lock_token: lockToken,
    p_lease_seconds: leaseSeconds
  })

  if (error) {
    throw new Error(`Error de infraestructura al adquirir lock de emisión: ${error.message}`)
  }

  const acquired = Boolean(data)
  if (acquired) {
    localEmissionLocks.add(lockKey)
  }

  return acquired
}

/**
 * Libera el lock de emisión distribuido en PostgreSQL si el token coincide
 */
export async function releaseEmissionLockDistributed(
  supabaseAdmin: SupabaseClient,
  lockKey: string,
  lockToken: string
): Promise<void> {
  localEmissionLocks.delete(lockKey)

  try {
    await supabaseAdmin.rpc('release_arca_emission_lock', {
      p_lock_key: lockKey,
      p_lock_token: lockToken
    })
  } catch {
    // Ignorar si ya expiró el lease
  }
}

/**
 * Genera una clave de idempotencia determinística
 */
export function buildIdempotencyKey(params: {
  companyId: string
  budgetId: string
  environment: 'homo' | 'prod'
  operationType: 'invoice' | 'credit_note' | 'debit_note'
  correctionRequestId?: string
  invoiceOriginalId?: string
}): string {
  const { companyId, budgetId, environment, operationType, correctionRequestId, invoiceOriginalId } = params
  if (operationType === 'invoice') {
    return `${companyId}:${budgetId}:${environment}:invoice`
  }
  const baseTarget = invoiceOriginalId || budgetId
  return `${companyId}:${baseTarget}:${environment}:${operationType}:${correctionRequestId || 'default'}`
}

export type ClaimResult =
  | { type: 'persisted'; attempt: InvoiceAttemptRecord }
  | { type: 'conflict_processing'; attempt: InvoiceAttemptRecord }
  | { type: 'needs_reconciliation'; attempt: InvoiceAttemptRecord }
  | { type: 'claimed'; attempt: InvoiceAttemptRecord }

/**
 * Reclama de forma atómica el intento de emisión en PostgreSQL
 */
export async function claimInvoiceAttempt(
  supabaseAdmin: SupabaseClient,
  params: {
    companyId: string
    budgetId: string
    environment: 'homo' | 'prod'
    operationType: 'invoice' | 'credit_note' | 'debit_note'
    idempotencyKey: string
    puntoVenta: number
    comprobanteTipo: number
    requestPayload: Record<string, unknown>
  }
): Promise<ClaimResult> {
  const { companyId, budgetId, environment, operationType, idempotencyKey, puntoVenta, comprobanteTipo, requestPayload } = params

  const { data, error } = await supabaseAdmin.rpc('claim_arca_invoice_attempt', {
    p_company_id: companyId,
    p_budget_id: budgetId,
    p_environment: environment,
    p_operation_type: operationType,
    p_idempotency_key: idempotencyKey,
    p_punto_venta: puntoVenta,
    p_comprobante_tipo: comprobanteTipo,
    p_request_payload: requestPayload
  })

  if (error) {
    throw new Error(`Error al reclamar intento de emisión atómico: ${error.message}`)
  }

  if (!data || !data.type || !data.attempt) {
    throw new Error('Respuesta inválida al reclamar intento de emisión')
  }

  return {
    type: data.type,
    attempt: data.attempt as InvoiceAttemptRecord
  }
}

export type ReconciliationResult =
  | { status: 'authorized'; authorized: true; cae: string; caeExpiresAt?: string; rawResponse?: unknown }
  | { status: 'not_found'; authorized: false }
  | { status: 'indeterminate'; authorized: false; error: string }

/**
 * Reconcilia un comprobante consultando ARCA para verificar si ya fue emitido de forma segura y tri-estado
 */
export async function reconcileVoucherWithArca(
  arca: Arca,
  comprobanteNumero: number,
  puntoVenta: number,
  comprobanteTipo: number
): Promise<ReconciliationResult> {
  try {
    const voucherInfo = await arca.electronicBillingService.getVoucherInfo(
      comprobanteNumero,
      puntoVenta,
      comprobanteTipo
    )

    const rawAny = voucherInfo as any
    const resGet = rawAny?.resultGet || rawAny
    const codAut = resGet?.codAutorizacion || resGet?.CAE || resGet?.cae || rawAny?.codAutorizacion
    const fchVto = resGet?.fchVto || resGet?.CAEFchVto || resGet?.caeFchVto || rawAny?.fchVto
    const resultado = resGet?.resultado || resGet?.Resultado || rawAny?.resultado

    if (codAut || resultado === 'A') {
      return {
        status: 'authorized',
        authorized: true,
        cae: String(codAut || ''),
        caeExpiresAt: fchVto,
        rawResponse: voucherInfo
      }
    }

    // Si ARCA respondió pero no tiene CAE o indica que no existe comprobante
    return {
      status: 'not_found',
      authorized: false
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)

    // Si ARCA devuelve explícitamente código de que no existe comprobante registrado
    if (errMsg.includes('602') || errMsg.toLowerCase().includes('no existe') || errMsg.toLowerCase().includes('no encontrado')) {
      return {
        status: 'not_found',
        authorized: false
      }
    }

    // Ante errores de red, timeout o fallo de servicio, es INDETERMINADO
    return {
      status: 'indeterminate',
      authorized: false,
      error: errMsg
    }
  }
}
