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

// In-memory mutex map para serializar emisiones concurrentes hacia el mismo punto de venta y comprobante
const activeEmissionLocks = new Set<string>()

export function getEmissionLockKey(companyId: string, env: string, ptoVta: number, cbteTipo: number): string {
  return `${companyId}:${env}:${ptoVta}:${cbteTipo}`
}

export function acquireEmissionLock(key: string): boolean {
  if (activeEmissionLocks.has(key)) {
    return false
  }
  activeEmissionLocks.add(key)
  return true
}

export function releaseEmissionLock(key: string): void {
  activeEmissionLocks.delete(key)
}

/**
 * Genera una clave de idempotencia determinística
 */
export function buildIdempotencyKey(params: {
  companyId: string
  budgetId: string
  environment: 'homo' | 'prod'
  operationType: 'invoice' | 'credit_note' | 'debit_note'
  correctionId?: string
}): string {
  const { companyId, budgetId, environment, operationType, correctionId } = params
  if (operationType === 'invoice') {
    return `${companyId}:${budgetId}:${environment}:invoice`
  }
  return `${companyId}:${budgetId}:${environment}:${operationType}:${correctionId || 'default'}`
}

export type ClaimResult =
  | { type: 'persisted'; attempt: InvoiceAttemptRecord }
  | { type: 'conflict_processing'; attempt: InvoiceAttemptRecord }
  | { type: 'needs_reconciliation'; attempt: InvoiceAttemptRecord }
  | { type: 'claimed'; attempt: InvoiceAttemptRecord }

/**
 * Reclama de forma atómica el intento de emisión
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

  // 1. Consultar intento existente
  const { data: existing, error: selectErr } = await supabaseAdmin
    .from('arca_invoice_attempts')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (selectErr) {
    throw new Error(`Error al consultar intentos de emisión: ${selectErr.message}`)
  }

  if (existing) {
    const attempt = existing as InvoiceAttemptRecord

    if (attempt.status === 'persisted') {
      return { type: 'persisted', attempt }
    }

    if (attempt.status === 'authorized_pending_persistence' || attempt.status === 'reconciliation_required') {
      return { type: 'needs_reconciliation', attempt }
    }

    if (attempt.status === 'processing') {
      const updatedAtMs = new Date(attempt.updated_at).getTime()
      const isRecent = Date.now() - updatedAtMs < 30000 // 30 segundos
      if (isRecent) {
        return { type: 'conflict_processing', attempt }
      }
    }

    // Si había fallado previamente (rejected) o processing expiró, reactivamos intento
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('arca_invoice_attempts')
      .update({
        status: 'processing',
        punto_venta: puntoVenta,
        comprobante_tipo: comprobanteTipo,
        request_payload: requestPayload,
        updated_at: new Date().toISOString()
      })
      .eq('id', attempt.id)
      .select()
      .single()

    if (updateErr) throw new Error(`Error actualizando intento: ${updateErr.message}`)
    return { type: 'claimed', attempt: updated as InvoiceAttemptRecord }
  }

  // 2. Insertar nuevo intento en estado processing
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('arca_invoice_attempts')
    .insert({
      company_id: companyId,
      budget_id: budgetId,
      environment,
      operation_type: operationType,
      idempotency_key: idempotencyKey,
      status: 'processing',
      punto_venta: puntoVenta,
      comprobante_tipo: comprobanteTipo,
      request_payload: requestPayload,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (insertErr) {
    throw new Error(`Error creando intento de emisión: ${insertErr.message}`)
  }

  return { type: 'claimed', attempt: inserted as InvoiceAttemptRecord }
}

/**
 * Reconcilia un comprobante consultando ARCA para verificar si ya fue emitido
 */
export async function reconcileVoucherWithArca(
  arca: Arca,
  comprobanteNumero: number,
  puntoVenta: number,
  comprobanteTipo: number
): Promise<{ authorized: boolean; cae?: string; caeExpiresAt?: string; rawResponse?: unknown }> {
  try {
    const voucherInfo = await arca.electronicBillingService.getVoucherInfo(
      comprobanteNumero,
      puntoVenta,
      comprobanteTipo
    )

    if (voucherInfo && (voucherInfo.resultado === 'A' || voucherInfo.codAutorizacion)) {
      return {
        authorized: true,
        cae: voucherInfo.codAutorizacion,
        caeExpiresAt: voucherInfo.fchVto,
        rawResponse: voucherInfo
      }
    }
  } catch {
    // Si no se encuentra en ARCA o falla la consulta
  }

  return { authorized: false }
}
