import { NextResponse } from 'next/server'
import { requireCompanyUser } from '@/lib/auth/requireCompanyUser'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { CreateInvoiceRequestSchema } from '@/lib/arca/validations'
import { calculateInvoiceTaxes } from '@/lib/arca/taxCalculator'
import { createArcaClient } from '@/lib/arca/arcaClient'
import { 
  buildIdempotencyKey, 
  claimInvoiceAttempt, 
  acquireEmissionLock, 
  releaseEmissionLock, 
  getEmissionLockKey,
  reconcileVoucherWithArca 
} from '@/lib/arca/idempotency'

export async function POST(request: Request) {
  let lockKey: string | null = null

  try {
    // 1. Autenticación y Autorización
    const auth = await requireCompanyUser({ allowedRoles: ['admin', 'super_admin'] })
    if (!auth.success) return auth.response

    const { companyId } = auth.user
    const supabaseAdmin = createSupabaseAdminClient()

    const rawBody = await request.json().catch(() => ({}))
    const validation = CreateInvoiceRequestSchema.safeParse(rawBody)

    if (!validation.success) {
      const errorMsg = validation.error.issues.map(i => i.message).join(', ')
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 })
    }

    const { 
      budget_id, 
      environment: reqEnv,
      cbteTipoOverride, 
      isCreditNote, 
      isDebitNote, 
      customAmount, 
      addIva, 
      serviceDates 
    } = validation.data

    const esCorrectivo = Boolean(isCreditNote || isDebitNote)
    const operationType = isCreditNote ? 'credit_note' : (isDebitNote ? 'debit_note' : 'invoice')
    const environment: 'homo' | 'prod' = reqEnv === 'prod' ? 'prod' : 'homo'

    // 2. Obtener datos del presupuesto e ítems (validando pertenencia a la empresa)
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

    // Obtener tipo de negocio de la empresa
    const { data: companyObj } = await supabaseAdmin
      .from('companies')
      .select('business_type')
      .eq('id', budget.company_id)
      .single()
    const businessType = companyObj?.business_type || 'products'

    // Si el presupuesto ya cuenta con CAE y no es una nota correctiva
    if (budget.afip_cae && !esCorrectivo) {
      return NextResponse.json({ 
        success: true, 
        message: 'El presupuesto ya cuenta con factura legalizada autorizada.',
        cae: budget.afip_cae,
        comprobante_numero: budget.afip_comprobante_numero,
        punto_venta: budget.company_afip_config?.punto_venta || 0
      })
    }

    // 3. Inicializar cliente ARCA para el entorno seleccionado
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

    // 4. Mapeo explícito de Condición IVA según normativa ARCA
    const esRI = credentials.tipoContribuyente === 'responsable_inscripto'
    const cuitLimpio = (client?.cuit || '').replace(/[-_ ]/g, '').trim()
    const esCuitValido = cuitLimpio.length === 11
    const esDniValido = cuitLimpio.length >= 7 && cuitLimpio.length <= 8
    const montoBase = customAmount 
      ? Number(customAmount) 
      : (existingDraft ? Number(existingDraft.total_amount) : Number(budget.total_amount))

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
            error: 'Para emitir Factura A es obligatorio que el cliente tenga un CUIT válido de 11 dígitos.'
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

    // Cálculo centralizado de impuestos (alícuota estricta 21% en A/B, sin IVA en C)
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

    // 5. Idempotencia y Reclamación de Intento
    const idempotencyKey = buildIdempotencyKey({
      companyId,
      budgetId: budget_id,
      environment,
      operationType,
      correctionId: esCorrectivo ? `${Date.now()}` : undefined
    })

    const claimResult = await claimInvoiceAttempt(supabaseAdmin, {
      companyId,
      budgetId: budget_id,
      environment,
      operationType,
      idempotencyKey,
      puntoVenta: credentials.puntoVenta,
      comprobanteTipo: cbteTipo,
      requestPayload: { montoBase, taxes, cbteTipo, docTipo, docNro }
    })

    if (claimResult.type === 'persisted') {
      return NextResponse.json({
        success: true,
        message: 'Comprobante previamente emitido y persistido.',
        cae: claimResult.attempt.cae,
        comprobante_numero: claimResult.attempt.comprobante_numero,
        punto_venta: claimResult.attempt.punto_venta,
        is_production: isProduction
      })
    }

    if (claimResult.type === 'conflict_processing') {
      return NextResponse.json({
        success: false,
        error: 'Ya existe una solicitud de emisión en proceso para este presupuesto. Aguarde unos segundos y vuelva a consultar.'
      }, { status: 409 })
    }

    // 6. Adquisición del Mutex Lock por Empresa + Entorno + Punto de Venta + Tipo de Comprobante
    lockKey = getEmissionLockKey(companyId, environment, credentials.puntoVenta, cbteTipo)
    const lockAcquired = acquireEmissionLock(lockKey)
    if (!lockAcquired) {
      return NextResponse.json({
        success: false,
        error: 'Hay otra emisión en curso en el mismo punto de venta. Intente nuevamente en unos instantes.'
      }, { status: 409 })
    }

    const attempt = claimResult.attempt
    let plannedNumber: number | null = attempt.comprobante_numero

    // 7. Si requiere reconciliación, verificar primero si ARCA ya autorizó
    if (claimResult.type === 'needs_reconciliation' && plannedNumber) {
      const reconciliation = await reconcileVoucherWithArca(
        arca,
        plannedNumber,
        credentials.puntoVenta,
        cbteTipo
      )

      if (reconciliation.authorized && reconciliation.cae) {
        // ARCA ya tenía el comprobante autorizado -> Persistir directamente sin llamar a createVoucher
        const fechaArgentina = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
        
        await persistInvoiceData(supabaseAdmin, {
          attemptId: attempt.id,
          companyId,
          budgetId: budget_id,
          clientId: budget.client_id,
          isCorrective: esCorrectivo,
          isCreditNote: Boolean(isCreditNote),
          totalAmount: taxes.montoTotal,
          cae: reconciliation.cae,
          caeExpiresAt: reconciliation.caeExpiresAt || null,
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
          is_production: isProduction,
          message: `Factura reconciliada y sincronizada con éxito (CAE: ${reconciliation.cae})`
        })
      }
    }

    // 8. Consultar último comprobante en ARCA
    const lastVoucherRes = await arca.electronicBillingService.getLastVoucher(credentials.puntoVenta, cbteTipo)
    plannedNumber = (Number(lastVoucherRes?.cbteNro) || 0) + 1

    // Guardar el número planificado en el intento antes de invocar a ARCA
    await supabaseAdmin
      .from('arca_invoice_attempts')
      .update({ comprobante_numero: plannedNumber, updated_at: new Date().toISOString() })
      .eq('id', attempt.id)

    const fechaArgentina = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()).replace(/-/g, '')

    // 9. Construir payload para ARCA WSFE
    const voucherData: any = {
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

    if (esCorrectivo && budget.afip_comprobante_numero) {
      voucherData.CbtesAsoc = [{
        Tipo: budget.afip_comprobante_tipo || (esRI ? (condicionIvaReceptor === 1 ? 1 : 6) : 11),
        PtoVta: credentials.puntoVenta,
        Nro: budget.afip_comprobante_numero
      }]
    }

    // 10. Solicitar autorización ante ARCA
    const createResult = await arca.electronicBillingService.createVoucher(voucherData)
    const resAny = createResult as any
    const resDet = resAny.response?.FeDetResp?.FECAEDetResponse?.[0]
    const resultado = resAny.response?.FeCabResp?.Resultado || resAny.Resultado || resDet?.Resultado
    const cae = resAny.cae || resAny.CAE || resDet?.CAE
    const caeFchVto = resAny.caeFchVto || resAny.CAEFchVto || resDet?.CAEFchVto
    const cbteDesde = resAny.cbteDesde || resAny.CbteDesde || resDet?.CbteDesde || plannedNumber

    if (resultado !== 'A') {
      const obs = resDet?.Observaciones?.Obs?.[0]?.Msg || resAny.Observaciones?.Obs?.[0]?.Msg
      const err = resAny.Errors?.Err?.[0]?.Msg || resAny.response?.Errors?.Err?.[0]?.Msg
      const errMsg = obs || err || `Autorización rechazada por ARCA (Resultado ${resultado})`

      await supabaseAdmin
        .from('arca_invoice_attempts')
        .update({
          status: 'rejected',
          error_message: errMsg,
          arca_response: createResult,
          updated_at: new Date().toISOString()
        })
        .eq('id', attempt.id)

      return NextResponse.json({ success: false, error: errMsg }, { status: 400 })
    }

    // 11. Guardar inmediatamente CAE y respuesta ARCA como authorized_pending_persistence
    await supabaseAdmin
      .from('arca_invoice_attempts')
      .update({
        status: 'authorized_pending_persistence',
        cae,
        cae_expires_at: caeFchVto ? `${caeFchVto.slice(0, 4)}-${caeFchVto.slice(4, 6)}-${caeFchVto.slice(6, 8)}` : null,
        arca_response: createResult,
        updated_at: new Date().toISOString()
      })
      .eq('id', attempt.id)

    // 12. Persistencia en Base de Datos
    const fechaFormateada = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())

    try {
      await persistInvoiceData(supabaseAdmin, {
        attemptId: attempt.id,
        companyId,
        budgetId: budget_id,
        clientId: budget.client_id,
        isCorrective: esCorrectivo,
        isCreditNote: Boolean(isCreditNote),
        totalAmount: taxes.montoTotal,
        cae,
        caeExpiresAt: caeFchVto ? `${caeFchVto.slice(0, 4)}-${caeFchVto.slice(4, 6)}-${caeFchVto.slice(6, 8)}` : null,
        comprobanteNumero: cbteDesde,
        comprobanteTipo: cbteTipo,
        invoiceDate: fechaFormateada,
        servicioDesde: voucherData.FchServDesde,
        servicioHasta: voucherData.FchServHasta,
        servicioVto: voucherData.FchVtoPago
      })
    } catch (persistErr: any) {
      console.error('[ARCA PERSISTENCE ERROR] CAE obtenido pero falló persistencia local:', persistErr)
      await supabaseAdmin
        .from('arca_invoice_attempts')
        .update({ status: 'reconciliation_required', error_message: persistErr.message, updated_at: new Date().toISOString() })
        .eq('id', attempt.id)

      return NextResponse.json({
        success: true,
        cae,
        invoice_number: cbteDesde,
        punto_venta: credentials.puntoVenta,
        status: 'reconciliation_required',
        warning: 'Factura autorizada por ARCA con éxito pero con demoras en la sincronización de base de datos local. El comprobante está resguardado.'
      })
    }

    return NextResponse.json({
      success: true,
      cae,
      invoice_number: cbteDesde,
      punto_venta: credentials.puntoVenta,
      is_production: isProduction,
      message: `Factura autorizada por ARCA con éxito (CAE: ${cae})`
    })

  } catch (error: any) {
    console.error('Error al emitir factura en ARCA:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al emitir factura en ARCA'
    }, { status: 500 })
  } finally {
    if (lockKey) {
      releaseEmissionLock(lockKey)
    }
  }
}

/**
 * Persiste los datos autorizados en la base de datos de forma atómica y consistente
 */
async function persistInvoiceData(
  supabaseAdmin: any,
  params: {
    attemptId: string
    companyId: string
    budgetId: string
    clientId: string
    isCorrective: boolean
    isCreditNote: boolean
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
    attemptId, companyId, budgetId, clientId, isCorrective, isCreditNote, 
    totalAmount, cae, caeExpiresAt, comprobanteNumero, comprobanteTipo, 
    invoiceDate, servicioDesde, servicioHasta, servicioVto 
  } = params

  // Intentar persistencia mediante la RPC transaccional
  const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('persist_arca_invoice_atomic', {
    p_attempt_id: attemptId,
    p_company_id: companyId,
    p_budget_id: budgetId,
    p_client_id: clientId,
    p_is_corrective: isCorrective,
    p_is_credit_note: isCreditNote,
    p_total_amount: totalAmount,
    p_cae: cae,
    p_cae_expires_at: caeExpiresAt,
    p_comprobante_numero: comprobanteNumero,
    p_comprobante_tipo: comprobanteTipo,
    p_invoice_date: invoiceDate,
    p_servicio_desde: servicioDesde || null,
    p_servicio_hasta: servicioHasta || null,
    p_servicio_vto: servicioVto || null
  })

  if (!rpcErr && rpcRes) {
    return
  }

  // Fallback directo si la función RPC aún no está migrada en el backend de Supabase
  if (isCorrective) {
    if (isCreditNote) {
      await supabaseAdmin
        .from('invoices')
        .update({ status: 'cancelled' })
        .eq('budget_id', budgetId)
        .eq('status', 'emitted')
    }

    const { error: insErr } = await supabaseAdmin
      .from('invoices')
      .insert({
        company_id: companyId,
        client_id: clientId,
        budget_id: budgetId,
        status: 'emitted',
        total_amount: isCreditNote ? -Math.abs(totalAmount) : Math.abs(totalAmount),
        afip_cae: cae,
        afip_cae_vencimiento: caeExpiresAt,
        afip_comprobante_numero: comprobanteNumero,
        afip_comprobante_tipo: comprobanteTipo,
        invoice_date: invoiceDate,
        invoice_number: String(comprobanteNumero),
        afip_servicio_desde: servicioDesde,
        afip_servicio_hasta: servicioHasta,
        afip_servicio_vto: servicioVto
      })

    if (insErr) throw insErr
  } else {
    const { error: bUpErr } = await supabaseAdmin
      .from('budgets')
      .update({
        afip_cae: cae,
        afip_cae_vencimiento: caeExpiresAt,
        afip_comprobante_numero: comprobanteNumero,
        afip_comprobante_tipo: comprobanteTipo,
        status: 'issued'
      })
      .eq('id', budgetId)

    if (bUpErr) throw bUpErr

    const { data: invRow } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .eq('budget_id', budgetId)
      .maybeSingle()

    const invoicePayload = {
      company_id: companyId,
      client_id: clientId,
      budget_id: budgetId,
      status: 'emitted',
      total_amount: totalAmount,
      afip_cae: cae,
      afip_cae_vencimiento: caeExpiresAt,
      afip_comprobante_numero: comprobanteNumero,
      afip_comprobante_tipo: comprobanteTipo,
      invoice_date: invoiceDate,
      invoice_number: String(comprobanteNumero),
      afip_servicio_desde: servicioDesde,
      afip_servicio_hasta: servicioHasta,
      afip_servicio_vto: servicioVto
    }

    if (invRow) {
      const { error: invUpErr } = await supabaseAdmin
        .from('invoices')
        .update(invoicePayload)
        .eq('budget_id', budgetId)
      if (invUpErr) throw invUpErr
    } else {
      const { error: invInsErr } = await supabaseAdmin
        .from('invoices')
        .insert(invoicePayload)
      if (invInsErr) throw invInsErr
    }
  }

  // Marcar intento como PERSISTED
  await supabaseAdmin
    .from('arca_invoice_attempts')
    .update({
      status: 'persisted',
      comprobante_numero: comprobanteNumero,
      cae,
      cae_expires_at: caeExpiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', attemptId)
}
