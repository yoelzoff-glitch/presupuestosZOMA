import { NextResponse } from 'next/server'
import { requireCompanyUser } from '@/lib/auth/requireCompanyUser'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { CreateInvoiceRequestSchema } from '@/lib/arca/validations'
import { calculateInvoiceTaxes } from '@/lib/arca/taxCalculator'
import { createArcaClient } from '@/lib/arca/arcaClient'
import {
  buildIdempotencyKey,
  claimInvoiceAttempt,
  acquireEmissionLockDistributed,
  releaseEmissionLockDistributed,
  getEmissionLockKey,
  reconcileVoucherWithArca
} from '@/lib/arca/idempotency'
import crypto from 'crypto'

function normalizeArcaDate(value?: string | null): string | null {
  if (!value) return null

  const digits = value.replace(/\D/g, '')

  if (!/^\d{8}$/.test(digits)) {
    throw new Error(`Fecha ARCA inválida: ${value}`)
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

export async function POST(request: Request) {
  let lockKey: string | null = null
  let lockToken: string | null = null
  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | null = null

  try {
    // 1. Autenticación y Autorización
    const auth = await requireCompanyUser({ allowedRoles: ['admin', 'super_admin'] })
    if (!auth.success) return auth.response

    const { companyId } = auth.user
    supabaseAdmin = createSupabaseAdminClient()

    const rawBody = await request.json().catch(() => ({}))
    const validation = CreateInvoiceRequestSchema.safeParse(rawBody)

    if (!validation.success) {
      const errorMsg = validation.error.issues.map(i => i.message).join(', ')
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 })
    }

    const {
      budget_id,
      environment,
      cbteTipoOverride,
      isCreditNote,
      isDebitNote,
      is_total_cancellation,
      invoice_original_id,
      correction_request_id,
      customAmount,
      addIva,
      serviceDates
    } = validation.data

    const esCorrectivo = Boolean(isCreditNote || isDebitNote)
    const operationType = isCreditNote ? 'credit_note' : (isDebitNote ? 'debit_note' : 'invoice')

    // 2. Pre-flight check de infraestructura
    const { error: infraCheckErr } = await supabaseAdmin
      .from('arca_invoice_attempts')
      .select('id')
      .limit(1)

    if (infraCheckErr) {
      return NextResponse.json({
        success: false,
        error: 'El servicio de facturación no está disponible temporalmente (Falta migración de infraestructura ARCA).'
      }, { status: 503 })
    }

    // 3. Obtener datos del presupuesto e ítems
    const { data: budget, error: bError } = await supabaseAdmin
      .from('budgets')
      .select('*, budget_items(*), clients(*)')
      .eq('id', budget_id)
      .single()

    if (bError || !budget) {
      return NextResponse.json({ success: false, error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    if (budget.company_id !== companyId) {
      return NextResponse.json({ success: false, error: 'No tiene permiso para facturar este presupuesto' }, { status: 403 })
    }

    // Reglas estrictas sobre presupuesto con CAE previo si no es correctivo
    if (budget.afip_cae && !esCorrectivo) {
      if (budget.arca_environment === environment) {
        return NextResponse.json({
          success: true,
          message: 'El presupuesto ya cuenta con factura autorizada en este entorno.',
          cae: budget.afip_cae,
          comprobante_numero: budget.afip_comprobante_numero,
          punto_venta: budget.afip_punto_venta || 0,
          environment: budget.arca_environment,
          is_production: environment === 'prod',
          status: 'persisted'
        })
      }

      if (budget.arca_environment && budget.arca_environment !== environment) {
        return NextResponse.json({
          success: false,
          error: `El presupuesto fue emitido previamente en entorno ${budget.arca_environment.toUpperCase()} y no puede reutilizarse en ${environment.toUpperCase()}. Debe crear un nuevo presupuesto para este entorno.`
        }, { status: 409 })
      }

      if (!budget.arca_environment) {
        return NextResponse.json({
          success: false,
          error: 'El comprobante existente no cuenta con entorno fiscal clasificado. Clasifique el comprobante legacy antes de continuar.'
        }, { status: 409 })
      }
    }

    // Obtener tipo de negocio de la empresa
    const { data: companyObj } = await supabaseAdmin
      .from('companies')
      .select('business_type')
      .eq('id', budget.company_id)
      .single()
    const businessType = companyObj?.business_type || 'products'

    // 4. Validaciones específicas para Notas de Crédito / Débito
    let originalInvoice: any = null
    let remainingBalance = 0

    if (esCorrectivo) {
      if (!invoice_original_id) {
        return NextResponse.json({
          success: false,
          error: 'invoice_original_id es obligatorio para emitir Notas de Crédito o Débito.'
        }, { status: 400 })
      }

      const { data: origInv, error: origInvErr } = await supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('id', invoice_original_id)
        .single()

      if (origInvErr || !origInv) {
        return NextResponse.json({
          success: false,
          error: 'Factura original a corregir no encontrada.'
        }, { status: 404 })
      }

      if (origInv.company_id !== companyId || origInv.budget_id !== budget_id) {
        return NextResponse.json({
          success: false,
          error: 'La factura original no corresponde a esta empresa o presupuesto.'
        }, { status: 403 })
      }

      if (
        !origInv.arca_environment ||
        !origInv.afip_punto_venta ||
        !origInv.afip_comprobante_tipo ||
        !origInv.afip_comprobante_numero ||
        !origInv.afip_cae
      ) {
        return NextResponse.json({
          success: false,
          error: 'La factura original no posee datos fiscales completos.'
        }, { status: 409 })
      }

      // Validar coincidencia de entorno
      if (origInv.arca_environment !== environment) {
        return NextResponse.json({
          success: false,
          error: `La factura original fue emitida en ${origInv.arca_environment.toUpperCase()} y la corrección debe realizarse en ese mismo entorno.`
        }, { status: 409 })
      }

      originalInvoice = origInv

      // Calcular saldo restante acreditable de la factura original
      if (isCreditNote) {
        const { data: existingNCs } = await supabaseAdmin
          .from('invoices')
          .select('total_amount')
          .eq('budget_id', budget_id)
          .in('afip_comprobante_tipo', [3, 8, 13])
          .eq('status', 'emitted')

        const totalCredited = (existingNCs || []).reduce((acc, curr) => acc + Math.abs(Number(curr.total_amount)), 0)
        remainingBalance = Math.max(0, Number(origInv.total_amount) - totalCredited)

        if (remainingBalance <= 0) {
          return NextResponse.json({
            success: false,
            error: 'La factura original ya ha sido totalmente acreditada y no posee saldo disponible.'
          }, { status: 400 })
        }
      }
    }

    // 5. Inicializar cliente ARCA para el entorno seleccionado
    const { arca, credentials, isProduction } = await createArcaClient(
      supabaseAdmin,
      companyId,
      environment
    )

    const client = Array.isArray(budget.clients) ? budget.clients[0] : budget.clients

    // Obtener la factura borrador existente (si existe)
    const { data: existingDraft } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('budget_id', budget_id)
      .eq('status', 'draft')
      .maybeSingle()

    // 6. Mapeo explícito de Condición IVA según normativa ARCA
    const esRI = credentials.tipoContribuyente === 'responsable_inscripto'
    const cuitLimpio = (client?.cuit || '').replace(/[-_ ]/g, '').trim()
    const esCuitValido = cuitLimpio.length === 11
    const esDniValido = cuitLimpio.length >= 7 && cuitLimpio.length <= 8

    let montoBase = customAmount
      ? Number(customAmount)
      : (existingDraft ? Number(existingDraft.total_amount) : Number(budget.total_amount))

    if (isCreditNote) {
      if (is_total_cancellation) {
        montoBase = remainingBalance
      } else if (montoBase > remainingBalance + 0.01) {
        return NextResponse.json({
          success: false,
          error: `El monto de la Nota de Crédito ($${montoBase.toLocaleString('es-AR')}) supera el saldo disponible acreditable ($${remainingBalance.toLocaleString('es-AR')}).`
        }, { status: 400 })
      }
    }

    const rawCondIva = (client?.condicion_iva || client?.tax_condition || '').toLowerCase().trim()
    let condicionIvaReceptor = 5 // Consumidor Final por defecto

    if (rawCondIva === 'responsable_inscripto' || rawCondIva === 'ri') {
      condicionIvaReceptor = 1
    } else if (rawCondIva === 'exento') {
      condicionIvaReceptor = 4
    } else if (rawCondIva === 'monotributo' || rawCondIva === 'monotributista') {
      condicionIvaReceptor = 6
    } else {
      condicionIvaReceptor = 5
    }

    let cbteTipo = 11 // Por defecto Factura C
    let docTipo = 99
    let docNro = 0

    if (esRI) {
      if (condicionIvaReceptor === 1) {
        if (!esCuitValido) {
          return NextResponse.json({
            success: false,
            error: 'Para emitir Factura A es obligatorio que el cliente tenga un CUIT válido de 11 dígitos y condición Responsable Inscripto.'
          }, { status: 400 })
        }
        cbteTipo = 1 // Factura A
        docTipo = 80 // CUIT
        docNro = parseInt(cuitLimpio, 10)
      } else {
        cbteTipo = 6 // Factura B
        docTipo = esCuitValido ? 80 : (esDniValido ? 96 : 99)
        docNro = cuitLimpio.length >= 7 ? parseInt(cuitLimpio, 10) : 0
      }
    } else {
      cbteTipo = 11 // Factura C (Monotributo)
      docTipo = esCuitValido ? 80 : (esDniValido ? 96 : 99)
      docNro = cuitLimpio.length >= 7 ? parseInt(cuitLimpio, 10) : 0
    }

    if (cbteTipoOverride) {
      if (esRI && [11, 12, 13].includes(cbteTipoOverride)) {
        return NextResponse.json({ success: false, error: 'Un Responsable Inscripto no puede emitir comprobantes tipo C.' }, { status: 400 })
      }
      if (!esRI && ![11, 12, 13].includes(cbteTipoOverride)) {
        return NextResponse.json({ success: false, error: 'Un Monotributista solo puede emitir comprobantes tipo C.' }, { status: 400 })
      }
      cbteTipo = cbteTipoOverride
      if ([1, 2, 3].includes(cbteTipo) && !esCuitValido) {
        return NextResponse.json({ success: false, error: 'Para comprobantes tipo A es obligatorio un CUIT válido.' }, { status: 400 })
      }
      if ([1, 2, 3].includes(cbteTipo)) {
        docTipo = 80
        docNro = parseInt(cuitLimpio, 10)
        condicionIvaReceptor = 1
      }
    }

    // Convertir a comprobante correctivo si es Nota de Crédito/Débito
    if (isCreditNote) {
      if (cbteTipo === 1) cbteTipo = 3
      else if (cbteTipo === 6) cbteTipo = 8
      else if (cbteTipo === 11) cbteTipo = 13
    } else if (isDebitNote) {
      if (cbteTipo === 1) cbteTipo = 2
      else if (cbteTipo === 6) cbteTipo = 7
      else if (cbteTipo === 11) cbteTipo = 12
    }

    // Cálculo centralizado de impuestos
    const taxes = calculateInvoiceTaxes({
      montoTotal: montoBase,
      cbteTipo,
      addIva,
      hasExistingDraft: Boolean(existingDraft)
    })

    const LIMITE_IDENTIFICACION = 10000000
    if (![1, 2, 3].includes(cbteTipo) && taxes.montoTotal > LIMITE_IDENTIFICACION && docTipo === 99) {
      return NextResponse.json({
        success: false,
        error: `Para montos superiores a $${LIMITE_IDENTIFICACION.toLocaleString('es-AR')} es obligatorio identificar al cliente con DNI o CUIT.`
      }, { status: 400 })
    }

    // 7. Idempotencia y Reclamación Atómica de Intento
    const idempotencyKey = buildIdempotencyKey({
      companyId,
      budgetId: budget_id,
      environment,
      operationType,
      correctionRequestId: correction_request_id,
      invoiceOriginalId: invoice_original_id
    })

    const claimResult = await claimInvoiceAttempt(supabaseAdmin, {
      companyId,
      budgetId: budget_id,
      environment,
      operationType,
      idempotencyKey,
      puntoVenta: credentials.puntoVenta,
      comprobanteTipo: cbteTipo,
      requestPayload: { montoBase, taxes, cbteTipo, docTipo, docNro, is_total_cancellation, correction_request_id, invoice_original_id }
    })

    if (claimResult.type === 'persisted') {
      return NextResponse.json({
        success: true,
        message: 'Comprobante previamente emitido y persistido.',
        cae: claimResult.attempt.cae,
        comprobante_numero: claimResult.attempt.comprobante_numero,
        punto_venta: claimResult.attempt.punto_venta,
        environment,
        is_production: isProduction,
        status: 'persisted'
      })
    }

    if (claimResult.type === 'conflict_processing') {
      return NextResponse.json({
        success: false,
        error: 'Ya existe una solicitud de emisión en proceso para este comprobante. Aguarde unos segundos y vuelva a consultar.'
      }, { status: 409 })
    }

    // 8. Adquisición del Lock Distribuido en PostgreSQL
    lockKey = getEmissionLockKey(companyId, environment, credentials.puntoVenta, cbteTipo)
    lockToken = crypto.randomUUID()
    const lockAcquired = await acquireEmissionLockDistributed(supabaseAdmin, lockKey, lockToken)

    if (!lockAcquired) {
      return NextResponse.json({
        success: false,
        error: 'Hay otra emisión en curso en el mismo punto de venta. Intente nuevamente en unos instantes.'
      }, { status: 409 })
    }

    const attempt = claimResult.attempt
    let plannedNumber: number | null = attempt.comprobante_numero

    // 9. Reconciliación Segura Tri-Estado
    if (claimResult.type === 'needs_reconciliation' && plannedNumber) {
      const reconciliation = await reconcileVoucherWithArca(
        arca,
        plannedNumber,
        credentials.puntoVenta,
        cbteTipo
      )

      if (reconciliation.status === 'authorized' && reconciliation.cae) {
        const fechaArgentina = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())

        await persistInvoiceData(supabaseAdmin, {
          attemptId: attempt.id,
          companyId,
          budgetId: budget_id,
          clientId: budget.client_id,
          environment,
          isCorrective: esCorrectivo,
          isCreditNote: Boolean(isCreditNote),
          isTotalCancellation: is_total_cancellation,
          invoiceOriginalId: invoice_original_id,
          totalAmount: taxes.montoTotal,
          cae: reconciliation.cae,
          caeExpiresAt: normalizeArcaDate(reconciliation.caeExpiresAt),
          comprobanteNumero: plannedNumber,
          comprobanteTipo: cbteTipo,
          invoiceDate: fechaArgentina,
          servicioDesde: serviceDates?.FchServDesde,
          servicioHasta: serviceDates?.FchServHasta,
          servicioVto: serviceDates?.FchVtoPago
        })

        return NextResponse.json({
          success: true,
          cae: reconciliation.cae,
          invoice_number: plannedNumber,
          punto_venta: credentials.puntoVenta,
          environment,
          is_production: isProduction,
          status: 'persisted',
          message: `Factura reconciliada y sincronizada con éxito (CAE: ${reconciliation.cae})`
        })
      } else if (reconciliation.status === 'indeterminate') {
        return NextResponse.json({
          success: false,
          error: `No se pudo verificar el estado previo en ARCA (${reconciliation.error}). Reintente en unos momentos.`
        }, { status: 503 })
      }
    }

    // 10. Si aún no tiene número planificado, consultar último comprobante en ARCA
    if (!plannedNumber) {
      const lastVoucherRes = await arca.electronicBillingService.getLastVoucher(credentials.puntoVenta, cbteTipo)
      plannedNumber = (Number(lastVoucherRes?.cbteNro) || 0) + 1

      // Fail-closed: Guardar el número planificado en DB antes de contactar a ARCA
      const { error: saveNumberErr } = await supabaseAdmin
        .from('arca_invoice_attempts')
        .update({ comprobante_numero: plannedNumber, updated_at: new Date().toISOString() })
        .eq('id', attempt.id)

      if (saveNumberErr) {
        throw new Error(`Fallo de persistencia previa al número planificado: ${saveNumberErr.message}`)
      }
    }

    const fechaArgentina = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()).replace(/-/g, '')

    // 11. Construir payload para ARCA WSFE
    const voucherData: Record<string, unknown> = {
      CantReg: 1,
      PtoVta: credentials.puntoVenta,
      CbteTipo: cbteTipo,
      Concepto: businessType === 'services' ? 2 : 1,
      DocTipo: docTipo,
      DocNro: docNro,
      CbteDesde: plannedNumber,
      CbteHasta: plannedNumber,
      CbteFch: fechaArgentina,
      ImpTotal: taxes.montoTotal,
      ImpTotConc: taxes.impTotConc,
      ImpNeto: taxes.impNeto,
      ImpOpEx: taxes.impOpEx,
      ImpIVA: taxes.impIva,
      ImpTrib: taxes.impTrib,
      CondicionIVAReceptorId: condicionIvaReceptor,
      MonId: 'PES',
      MonCotiz: 1
    }

    if (businessType === 'services') {
      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth()

      const formatDate = (d: Date) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}${m}${day}`
      }

      const defaultDesde = formatDate(new Date(year, month, 1))
      const defaultHasta = formatDate(new Date(year, month + 1, 0))
      const defaultVto = formatDate(new Date(year, month, today.getDate() + 10))

      voucherData.FchServDesde = serviceDates?.FchServDesde?.replace(/-/g, '') || defaultDesde
      voucherData.FchServHasta = serviceDates?.FchServHasta?.replace(/-/g, '') || defaultHasta
      voucherData.FchVtoPago = serviceDates?.FchVtoPago?.replace(/-/g, '') || defaultVto
    }

    if (taxes.ivaArray.length > 0) {
      voucherData.Iva = taxes.ivaArray
    }

    // Asociar comprobante original si es nota correctiva
    if (esCorrectivo && originalInvoice) {
      voucherData.CbtesAsoc = [{
        Tipo: originalInvoice.afip_comprobante_tipo,
        PtoVta: originalInvoice.afip_punto_venta,
        Nro: originalInvoice.afip_comprobante_numero
      }]
    }

    // 12. Solicitar autorización ante ARCA
    let createResult: unknown
    try {
      createResult = await arca.electronicBillingService.createVoucher(voucherData as any)
    } catch (arcaNetErr: unknown) {
      const netMsg = arcaNetErr instanceof Error ? arcaNetErr.message : String(arcaNetErr)
      await supabaseAdmin
        .from('arca_invoice_attempts')
        .update({
          status: 'reconciliation_required',
          error_message: `Error de red durante emisión en ARCA: ${netMsg}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', attempt.id)

      return NextResponse.json({
        success: false,
        error: `La solicitud ante ARCA se interrumpió (${netMsg}). El comprobante quedó registrado para reconciliación automática.`
      }, { status: 504 })
    }

    const resAny = createResult as any
    const resDet = resAny.response?.FeDetResp?.FECAEDetResponse?.[0]
    const resultado = resAny.response?.FeCabResp?.Resultado || resAny.Resultado || resDet?.Resultado
    const cae = resAny.cae || resAny.CAE || resDet?.CAE
    const caeFchVto = resAny.caeFchVto || resAny.CAEFchVto || resDet?.CAEFchVto
    const cbteDesde = resAny.cbteDesde || resAny.CbteDesde || resDet?.CbteDesde || plannedNumber

    if (resultado !== 'A' || !cae) {
      const obs = resDet?.Observaciones?.Obs?.[0]?.Msg || resAny.Observaciones?.Obs?.[0]?.Msg
      const err = resAny.Errors?.Err?.[0]?.Msg || resAny.response?.Errors?.Err?.[0]?.Msg
      const errMsg = obs || err || `Autorización rechazada por ARCA (Resultado ${resultado})`

      await supabaseAdmin
        .from('arca_invoice_attempts')
        .update({
          status: 'rejected',
          error_message: errMsg,
          arca_response: createResult as Record<string, unknown>,
          updated_at: new Date().toISOString()
        })
        .eq('id', attempt.id)

      return NextResponse.json({ success: false, error: errMsg }, { status: 400 })
    }

    // 13. Guardar inmediatamente CAE y respuesta ARCA como authorized_pending_persistence
    const { error: authPendingErr } = await supabaseAdmin
      .from('arca_invoice_attempts')
      .update({
        status: 'authorized_pending_persistence',
        cae,
        cae_expires_at: normalizeArcaDate(caeFchVto),
        arca_response: createResult as Record<string, unknown>,
        updated_at: new Date().toISOString()
      })
      .eq('id', attempt.id)

    if (authPendingErr) {
      console.error('[ARCA CRITICAL] Error actualizando authorized_pending_persistence:', authPendingErr)
    }

    // 14. Persistencia Transaccional Atómica en Base de Datos (FAIL-CLOSED)
    const fechaFormateada = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())

    try {
      await persistInvoiceData(supabaseAdmin, {
        attemptId: attempt.id,
        companyId,
        budgetId: budget_id,
        clientId: budget.client_id,
        environment,
        isCorrective: esCorrectivo,
        isCreditNote: Boolean(isCreditNote),
        isTotalCancellation: is_total_cancellation,
        invoiceOriginalId: invoice_original_id,
        totalAmount: taxes.montoTotal,
        cae,
        caeExpiresAt: normalizeArcaDate(caeFchVto),
        comprobanteNumero: cbteDesde,
        comprobanteTipo: cbteTipo,
        invoiceDate: fechaFormateada,
        servicioDesde: voucherData.FchServDesde as string | undefined,
        servicioHasta: voucherData.FchServHasta as string | undefined,
        servicioVto: voucherData.FchVtoPago as string | undefined
      })
    } catch (persistErr: unknown) {
      const errMsg = persistErr instanceof Error ? persistErr.message : String(persistErr)
      console.error('[ARCA PERSISTENCE ERROR] CAE obtenido pero falló persistencia local:', errMsg)

      await supabaseAdmin
        .from('arca_invoice_attempts')
        .update({
          status: 'reconciliation_required',
          error_message: errMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', attempt.id)

      return NextResponse.json({
        success: true,
        cae,
        invoice_number: cbteDesde,
        punto_venta: credentials.puntoVenta,
        environment,
        is_production: isProduction,
        status: 'reconciliation_required',
        warning: 'Factura autorizada por ARCA con éxito pero con demoras en la sincronización de base de datos local. El comprobante está resguardado.'
      })
    }

    return NextResponse.json({
      success: true,
      cae,
      invoice_number: cbteDesde,
      punto_venta: credentials.puntoVenta,
      environment,
      is_production: isProduction,
      status: 'persisted',
      message: `Factura autorizada por ARCA con éxito (CAE: ${cae})`
    })

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    const errStatus = (error as Record<string, unknown>)?.status as number || 500
    console.error('Error al emitir factura en ARCA:', error)
    return NextResponse.json({
      success: false,
      error: errMsg || 'Error al emitir factura en ARCA'
    }, { status: errStatus })
  } finally {
    if (supabaseAdmin && lockKey && lockToken) {
      await releaseEmissionLockDistributed(supabaseAdmin, lockKey, lockToken)
    }
  }
}

/**
 * Persiste los datos autorizados en la base de datos de forma atómica y consistente mediante RPC V3
 */
async function persistInvoiceData(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  params: {
    attemptId: string
    companyId: string
    budgetId: string
    clientId: string
    environment: 'homo' | 'prod'
    isCorrective: boolean
    isCreditNote: boolean
    isTotalCancellation?: boolean
    invoiceOriginalId?: string
    totalAmount: number
    cae: string
    caeExpiresAt: string | null
    comprobanteNumero: number
    comprobanteTipo: number
    invoiceDate: string
    servicioDesde?: string
    servicioHasta?: string
    servicioVto?: string
  }
) {
  const {
    attemptId, companyId, budgetId, clientId, environment, isCorrective, isCreditNote,
    isTotalCancellation, invoiceOriginalId, totalAmount, cae, caeExpiresAt,
    comprobanteNumero, comprobanteTipo, invoiceDate, servicioDesde, servicioHasta, servicioVto
  } = params

  const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('persist_arca_invoice_atomic', {
    p_attempt_id: attemptId,
    p_company_id: companyId,
    p_budget_id: budgetId,
    p_client_id: clientId,
    p_environment: environment,
    p_is_corrective: isCorrective,
    p_is_credit_note: isCreditNote,
    p_is_total_cancellation: isTotalCancellation ?? true,
    p_total_amount: totalAmount,
    p_cae: cae,
    p_cae_expires_at: caeExpiresAt,
    p_comprobante_numero: comprobanteNumero,
    p_comprobante_tipo: comprobanteTipo,
    p_invoice_date: invoiceDate,
    p_servicio_desde: servicioDesde || null,
    p_servicio_hasta: servicioHasta || null,
    p_servicio_vto: servicioVto || null,
    p_invoice_original_id: invoiceOriginalId || null
  })

  if (rpcErr) {
    throw new Error(`Fallo en persist_arca_invoice_atomic: ${rpcErr.message}`)
  }

  if (!rpcRes || !rpcRes.success) {
    throw new Error('La función de persistencia atómica no confirmó la actualización.')
  }
}
