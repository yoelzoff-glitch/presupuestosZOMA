import { NextResponse } from 'next/server'
import { createSupabaseAdminClient, getServerUserContext } from '@/lib/supabase/server'
import { Arca } from '@arcasdk/core'
import { SupabaseTicketStorage } from '@/lib/afip/supabase-ticket-storage'
import fs from 'fs'
import path from 'path'
import os from 'os'

export async function POST(request: Request) {
  const tempDir = os.tmpdir()
  const certPath = path.join(tempDir, `cert_inv_${Date.now()}.crt`)
  const keyPath = path.join(tempDir, `key_inv_${Date.now()}.key`)

  try {
    const supabaseAdmin = createSupabaseAdminClient()

    // 1. Autenticación robusta de sesión (Cookies SSR / Bearer token)
    let companyId: string | null = null

    // Intento 1: Sesión por Cookies (SSR Next.js)
    const userContext = await getServerUserContext()
    if (userContext?.idEmpresa) {
      companyId = userContext.idEmpresa
    }

    // Intento 2: Header Authorization Bearer
    if (!companyId) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '').trim()
        const { data: { user } } = await supabaseAdmin.auth.getUser(token)
        if (user) {
          const { data: profile } = await supabaseAdmin
            .from('users_profiles')
            .select('company_id')
            .eq('id', user.id)
            .single()
          companyId = profile?.company_id || null
        }
      }
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión para facturar.' }, { status: 401 })
    }

    const { budget_id, cbteTipoOverride, isCreditNote, isDebitNote, customAmount, addIva, serviceDates } = await request.json().catch(() => ({}))
    if (!budget_id) return NextResponse.json({ error: 'Falta budget_id' }, { status: 400 })

    const esCorrectivo = isCreditNote || isDebitNote

    // 2. Obtener datos del presupuesto e ítems (validando pertenencia a la empresa del usuario)
    const { data: budget, error: bError } = await supabaseAdmin
      .from('budgets')
      .select('*, budget_items(*), clients(*)')
      .eq('id', budget_id)
      .single()

    if (bError || !budget) throw new Error('Presupuesto no encontrado')

    if (budget.company_id !== companyId) {
      return NextResponse.json({ error: 'No tiene permiso para facturar este presupuesto' }, { status: 403 })
    }

    // Obtener tipo de negocio de la empresa
    const { data: companyObj } = await supabaseAdmin
      .from('companies')
      .select('business_type')
      .eq('id', budget.company_id)
      .single()
    const businessType = companyObj?.business_type || 'products'

    if (budget.afip_cae && !esCorrectivo) {
      // Sincronización si ya tiene CAE en la base de datos
      await supabaseAdmin
        .from('invoices')
        .update({
          status: 'emitted',
          afip_cae: budget.afip_cae,
          afip_cae_vencimiento: budget.afip_cae_vencimiento,
          afip_comprobante_numero: budget.afip_comprobante_numero,
          afip_comprobante_tipo: budget.afip_comprobante_tipo
        })
        .eq('budget_id', budget_id)

      return NextResponse.json({ 
        success: true, 
        message: 'Sincronizado: El presupuesto ya tenía factura emitida.',
        cae: budget.afip_cae 
      })
    }

    const client = Array.isArray(budget.clients) ? budget.clients[0] : budget.clients

    // Obtener la factura borrador existente (si existe)
    const { data: existingDraft } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('budget_id', budget_id)
      .eq('status', 'draft')
      .maybeSingle()

    // 3. Obtener configuración fiscal de la empresa
    const { data: config, error: cError } = await supabaseAdmin
      .from('afip_configs')
      .select('*')
      .eq('company_id', budget.company_id)
      .single()

    if (cError || !config) throw new Error('Configuración fiscal no encontrada para esta empresa')
    if (!config.cert_content || !config.key_content || !config.cuit) {
      throw new Error('Certificados o CUIT no configurados en la sección fiscal')
    }

    const ptoVta = Number(config.punto_venta)
    if (!ptoVta || ptoVta <= 0) {
      throw new Error('Debe configurar un Punto de Venta válido mayor a 0 en Configuración Fiscal')
    }

    // 4. Inicializar ARCA con almacenamiento persistente de tickets (L1 Disco + L2 Supabase)
    const cleanCert = config.cert_content.split('===WSAA_TICKET')[0].trim()
    const cleanKey = config.key_content.split('===WSAA_TICKET')[0].replace(/\r\n/g, '\n').trim()
    const cuitClean = config.cuit.replace(/-/g, '').trim()
    const isProduction = !config.is_sandbox

    fs.writeFileSync(certPath, cleanCert)
    fs.writeFileSync(keyPath, cleanKey)

    const ticketStorage = new SupabaseTicketStorage({
      supabaseAdmin,
      companyId,
      cuit: cuitClean,
      production: isProduction
    })

    const arca = new Arca({
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8'),
      cuit: parseInt(cuitClean),
      production: isProduction,
      ticketStorage,
      useHttpsAgent: true
    })

    // 5. Lógica impositiva y determinación del comprobante ARCA
    const esRI = config.tipo_contribuyente === 'responsable_inscripto'
    const cuitLimpio = client?.cuit?.replace(/-/g, '').trim() || ''
    const esCuitValido = cuitLimpio.length === 11
    const esDniValido = cuitLimpio.length >= 7 && cuitLimpio.length <= 8
    let montoTotal = customAmount 
      ? Number(customAmount) 
      : (existingDraft ? Number(existingDraft.total_amount) : Number(budget.total_amount))

    // Límite de identificación a Consumidor Final según normativa ARCA vigente (10 Millones)
    const LIMITE_IDENTIFICACION = 10000000

    let cbteTipo = 11 // Por defecto Factura C (Monotributo)
    let docTipo = 99
    let docNro = 0
    let condicionIvaReceptor = 5 // Consumidor Final

    // Mapear condición IVA del cliente si está presente en DB
    const clientCondIva = (client?.tax_condition || client?.condicion_iva || '').toLowerCase()
    if (clientCondIva === 'responsable_inscripto' || clientCondIva === 'ri') {
      condicionIvaReceptor = 1
    } else if (clientCondIva === 'monotributo' || clientCondIva === 'monotributista') {
      condicionIvaReceptor = 6
    } else if (clientCondIva === 'exento') {
      condicionIvaReceptor = 4
    }

    if (esRI) {
      if (client?.client_type === 'distribuidor' || condicionIvaReceptor === 1) {
        if (!esCuitValido) {
          throw new Error('Para emitir Factura A se requiere un CUIT válido del cliente (11 dígitos)')
        }
        cbteTipo = 1 // Factura A
        docTipo = 80 // CUIT
        docNro = parseInt(cuitLimpio)
        condicionIvaReceptor = 1 // Responsable Inscripto
      } else {
        cbteTipo = 6 // Factura B
        docTipo = esCuitValido ? 80 : (esDniValido ? 96 : 99)
        docNro = cuitLimpio.length >= 7 ? parseInt(cuitLimpio) : 0
        if (condicionIvaReceptor === 5 && esCuitValido) {
          // Si tiene CUIT pero es Factura B, es Consumidor Final o Monotributo
          condicionIvaReceptor = clientCondIva === 'monotributo' ? 6 : 5
        }
      }
    } else {
      // Monotributista (Factura C)
      cbteTipo = 11
      docTipo = esCuitValido ? 80 : (esDniValido ? 96 : 99)
      docNro = cuitLimpio.length >= 7 ? parseInt(cuitLimpio) : 0
      if (!clientCondIva) {
        condicionIvaReceptor = esCuitValido ? 6 : 5
      }
    }

    // Aplicar Override si fue especificado por el usuario
    if (cbteTipoOverride) {
      if (esRI && cbteTipoOverride === 11) throw new Error('Un Responsable Inscripto no puede emitir Factura C')
      if (!esRI && cbteTipoOverride !== 11) throw new Error('Un Monotributista solo puede emitir Factura C')
      
      cbteTipo = cbteTipoOverride
      if (cbteTipo === 1 && !esCuitValido) throw new Error('Para Factura A es obligatorio un CUIT válido del cliente')
      
      if (cbteTipo === 1) {
         docTipo = 80
         docNro = parseInt(cuitLimpio)
         condicionIvaReceptor = 1
      } else if (cbteTipo === 6) {
         docTipo = esCuitValido ? 80 : (esDniValido ? 96 : 99)
         docNro = cuitLimpio.length >= 7 ? parseInt(cuitLimpio) : 0
      }
    }

    // Convertir a comprobante correctivo de AFIP si es Nota de Crédito/Débito
    if (isCreditNote) {
      if (cbteTipo === 1) cbteTipo = 3   // Nota de Crédito A
      else if (cbteTipo === 6) cbteTipo = 8   // Nota de Crédito B
      else if (cbteTipo === 11) cbteTipo = 13 // Nota de Crédito C
    } else if (isDebitNote) {
      if (cbteTipo === 1) cbteTipo = 2   // Nota de Débito A
      else if (cbteTipo === 6) cbteTipo = 7   // Nota de Débito B
      else if (cbteTipo === 11) cbteTipo = 12 // Nota de Débito C
    }

    // Aplicar cálculo de IVA si corresponde
    if (addIva && !existingDraft && (cbteTipo === 1 || cbteTipo === 6 || cbteTipo === 3 || cbteTipo === 8 || cbteTipo === 2 || cbteTipo === 7)) {
      montoTotal = parseFloat((montoTotal * 1.21).toFixed(2))
    }

    // Validación final de límite de identificación de Consumidor Final
    if (cbteTipo !== 1 && cbteTipo !== 3 && cbteTipo !== 2 && montoTotal > LIMITE_IDENTIFICACION && docTipo === 99) {
       throw new Error(`Para montos mayores a $${LIMITE_IDENTIFICACION.toLocaleString('es-AR')} es obligatorio identificar al cliente con DNI o CUIT`)
    }

    // Fecha en zona horaria oficial de Argentina (YYYYMMDD)
    const fechaArgentina = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()).replace(/-/g, '')

    // 6. Construir objeto Voucher para ARCA WSFE
    const voucherData: any = {
      CantReg: 1,
      PtoVta: ptoVta,
      CbteTipo: cbteTipo,
      Concepto: businessType === 'services' ? 2 : 1, // 1: Productos, 2: Servicios
      DocTipo: docTipo,
      DocNro: docNro,
      CbteFch: fechaArgentina,
      ImpTotal: montoTotal,
      ImpTotConc: 0,
      ImpNeto: (cbteTipo === 1 || cbteTipo === 6 || cbteTipo === 3 || cbteTipo === 8 || cbteTipo === 2 || cbteTipo === 7)
        ? parseFloat((montoTotal / 1.21).toFixed(2)) 
        : montoTotal,
      ImpOpEx: 0,
      ImpIVA: (cbteTipo === 1 || cbteTipo === 6 || cbteTipo === 3 || cbteTipo === 8 || cbteTipo === 2 || cbteTipo === 7)
        ? parseFloat((montoTotal - (montoTotal / 1.21)).toFixed(2)) 
        : 0,
      ImpTrib: 0,
      CondicionIVAReceptorId: condicionIvaReceptor,
      MonId: 'PES',
      MonCotiz: 1
    }

    if (businessType === 'services') {
      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth()

      const formatDateForAfip = (d: Date) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}${m}${day}`
      }

      const defaultDesde = formatDateForAfip(new Date(year, month, 1))
      const defaultHasta = formatDateForAfip(new Date(year, month + 1, 0))
      
      const todayCopy = new Date()
      todayCopy.setDate(todayCopy.getDate() + 10)
      const defaultVto = formatDateForAfip(todayCopy)

      voucherData.FchServDesde = serviceDates?.FchServDesde?.replace(/-/g, '') || defaultDesde
      voucherData.FchServHasta = serviceDates?.FchServHasta?.replace(/-/g, '') || defaultHasta
      voucherData.FchVtoPago = serviceDates?.FchVtoPago?.replace(/-/g, '') || defaultVto
    }

    if (cbteTipo === 1 || cbteTipo === 6 || cbteTipo === 3 || cbteTipo === 8 || cbteTipo === 2 || cbteTipo === 7) {
      voucherData.Iva = [{
        Id: 5, // 21%
        BaseImp: voucherData.ImpNeto,
        Importe: voucherData.ImpIVA
      }]
    }

    // Agregar comprobante asociado oficial si es Nota de Crédito/Débito
    if (esCorrectivo && budget.afip_comprobante_numero) {
      voucherData.CbtesAsoc = [{
        Tipo: budget.afip_comprobante_tipo || (esRI ? (client?.client_type === 'distribuidor' || esCuitValido ? 1 : 6) : 11),
        PtoVta: ptoVta,
        Nro: budget.afip_comprobante_numero
      }]
    }

    // 7. Solicitar CAE ante ARCA
    const result = await arca.electronicBillingService.createNextVoucher(voucherData)

    const resAny = result as any
    const resDet = resAny.response?.FeDetResp?.FECAEDetResponse?.[0]
    const status = resAny.response?.FeCabResp?.Resultado || resAny.Resultado || resDet?.Resultado
    const cae = resAny.cae || resAny.CAE || resDet?.CAE
    const caeFchVto = resAny.caeFchVto || resAny.CAEFchVto || resDet?.CAEFchVto
    const cbteNro = resAny.cbteDesde || resAny.CbteDesde || resDet?.CbteDesde

    if (status !== 'A') {
      const obs = resDet?.Observaciones?.Obs?.[0]?.Msg || resAny.Observaciones?.Obs?.[0]?.Msg
      const err = resAny.Errors?.Err?.[0]?.Msg || resAny.response?.Errors?.Err?.[0]?.Msg
      const msg = obs || err || `Error ARCA (Resultado ${status})`
      throw new Error(msg)
    }

    const fechaFormateada = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())

    // 8. Persistir comprobante en base de datos
    if (esCorrectivo) {
      if (isCreditNote) {
        const esAnulacionTotal = !customAmount || Number(customAmount) >= Number(budget.total_amount)
        if (esAnulacionTotal) {
          await supabaseAdmin
            .from('invoices')
            .update({ status: 'cancelled' })
            .eq('budget_id', budget_id)
            .eq('status', 'emitted')
        }
      }

      await supabaseAdmin
        .from('invoices')
        .insert({
          company_id: budget.company_id,
          client_id: budget.client_id,
          budget_id: budget_id,
          status: 'emitted',
          total_amount: isCreditNote ? -montoTotal : montoTotal,
          afip_cae: cae,
          afip_cae_vencimiento: caeFchVto,
          afip_comprobante_numero: cbteNro,
          afip_comprobante_tipo: cbteTipo,
          invoice_date: fechaFormateada,
          invoice_number: cbteNro,
          ...(businessType === 'services' ? {
            afip_servicio_desde: voucherData.FchServDesde,
            afip_servicio_hasta: voucherData.FchServHasta,
            afip_servicio_vto: voucherData.FchVtoPago
          } : {})
        })
    } else {
      await supabaseAdmin
        .from('budgets')
        .update({
          afip_cae: cae,
          afip_cae_vencimiento: caeFchVto,
          afip_comprobante_numero: cbteNro,
          afip_comprobante_tipo: cbteTipo,
          status: 'issued'
        })
        .eq('id', budget_id)

      const { data: invRow } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('budget_id', budget_id)
        .maybeSingle()

      if (invRow) {
        await supabaseAdmin
          .from('invoices')
          .update({
            status: 'emitted',
            total_amount: montoTotal,
            afip_cae: cae,
            afip_cae_vencimiento: caeFchVto,
            afip_comprobante_numero: cbteNro,
            afip_comprobante_tipo: cbteTipo,
            invoice_date: fechaFormateada,
            invoice_number: cbteNro,
            ...(businessType === 'services' ? {
              afip_servicio_desde: voucherData.FchServDesde,
              afip_servicio_hasta: voucherData.FchServHasta,
              afip_servicio_vto: voucherData.FchVtoPago
            } : {})
          })
          .eq('budget_id', budget_id)
      } else {
        await supabaseAdmin
          .from('invoices')
          .insert({
            company_id: budget.company_id,
            client_id: budget.client_id,
            budget_id: budget_id,
            status: 'emitted',
            total_amount: montoTotal,
            afip_cae: cae,
            afip_cae_vencimiento: caeFchVto,
            afip_comprobante_numero: cbteNro,
            afip_comprobante_tipo: cbteTipo,
            invoice_date: fechaFormateada,
            invoice_number: cbteNro,
            ...(businessType === 'services' ? {
              afip_servicio_desde: voucherData.FchServDesde,
              afip_servicio_hasta: voucherData.FchServHasta,
              afip_servicio_vto: voucherData.FchVtoPago
            } : {})
          })
      }
    }

    return NextResponse.json({
      success: true,
      cae: cae,
      invoice_number: cbteNro,
      punto_venta: ptoVta,
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
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath)
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath)
  }
}
