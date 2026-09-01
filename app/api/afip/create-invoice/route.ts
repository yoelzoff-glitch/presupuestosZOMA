import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Arca } from '@arcasdk/core'
import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'

// AFIP homologation servers use 1024-bit Diffie-Hellman keys. Modern Node/OpenSSL (>= 17) requires 2048-bit keys by default (@SECLEVEL=2).
// Lowering the security level to 1 programmatically bypasses the 'dh key too small' error.
https.globalAgent.options.ciphers = 'DEFAULT:@SECLEVEL=1'

export async function POST(request: Request) {
  const tempDir = os.tmpdir()
  const certPath = path.join(tempDir, `cert_inv_${Date.now()}.crt`)
  const keyPath = path.join(tempDir, `key_inv_${Date.now()}.key`)

  try {
    const { budget_id, cbteTipoOverride, isCreditNote, isDebitNote, customAmount, addIva, serviceDates } = await request.json()
    if (!budget_id) return NextResponse.json({ error: 'Falta budget_id' }, { status: 400 })

    const supabaseAdmin = createSupabaseAdminClient()
    const esCorrectivo = isCreditNote || isDebitNote

    // 1. Obtener datos del presupuesto e ítems (con datos del cliente)
    const { data: budget, error: bError } = await supabaseAdmin
      .from('budgets')
      .select('*, budget_items(*), clients(*)')
      .eq('id', budget_id)
      .single()

    if (bError || !budget) throw new Error('Presupuesto no encontrado')

    // Obtener tipo de negocio de la empresa
    const { data: companyObj } = await supabaseAdmin
      .from('companies')
      .select('business_type')
      .eq('id', budget.company_id)
      .single()
    const businessType = companyObj?.business_type || 'products'
    

    
    if (budget.afip_cae && !esCorrectivo) {
      // Sincronización automática si ya tiene CAE y no es un comprobante correctivo
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

    // 2. Obtener config fiscal
    const { data: config, error: cError } = await supabaseAdmin
      .from('afip_configs')
      .select('*')
      .eq('company_id', budget.company_id)
      .single()

    if (cError || !config) throw new Error('Configuración fiscal no encontrada')

    // 3. Inicializar ARCA
    const cleanKey = config.key_content.replace(/\r\n/g, '\n').trim()
    
    // Separate certificate content and cached ticket
    const certParts = config.cert_content.split('===WSAA_TICKET===')
    const actualCert = certParts[0].trim()
    const cachedTicketStr = certParts[1]?.trim()

    let cachedTicket: any = null
    if (cachedTicketStr) {
      try {
        cachedTicket = JSON.parse(cachedTicketStr)
      } catch (e) {
        console.error('Failed to parse cached ticket:', e)
      }
    }

    const now = Date.now()
    const isTicketValid = cachedTicket && 
      cachedTicket.expiresAt && 
      cachedTicket.expiresAt > now + 60000 && 
      cachedTicket.production === !config.is_sandbox

    if (!isTicketValid) {
      try {
        const ticketDir = path.join(os.tmpdir(), 'arca-tickets-stable')
        if (fs.existsSync(ticketDir)) {
          fs.rmSync(ticketDir, { recursive: true, force: true })
        }
      } catch (e) {}
    }

    const arcaOptions: any = {
      key: cleanKey,
      cert: actualCert,
      cuit: parseInt(config.cuit.replace(/-/g, '')),
      production: !config.is_sandbox,
      useHttpsAgent: true,
    }

    if (isTicketValid) {
      arcaOptions.credentials = cachedTicket.credentials
      arcaOptions.handleTicket = true
      console.log('Using valid WSAA ticket from database cache.')
    } else {
      arcaOptions.ticketPath = path.join(os.tmpdir(), 'arca-tickets-stable')
      console.log('No valid WSAA ticket in database. Fetching fresh WSAA ticket.')
    }

    const arca = new Arca(arcaOptions)

    // 5. Determinar tipo de comprobante y lógica de IVA
    const esRI = config.tipo_contribuyente === 'responsable_inscripto'
    const cuitLimpio = client?.cuit?.replace(/-/g, '') || ''
    const esCuitValido = cuitLimpio.length === 11
    const esDniValido = cuitLimpio.length >= 7 && cuitLimpio.length <= 8
    let montoTotal = customAmount 
      ? Number(customAmount) 
      : (existingDraft ? Number(existingDraft.total_amount) : Number(budget.total_amount));

    // Límite AFIP identificación (Aprox mayo 2024)
    const LIMITE_IDENTIFICACION = 191624

    let cbteTipo = 11 // Por defecto Factura C (Monotributo)
    let docTipo = 99
    let docNro = 0
    let condicionIvaReceptor = 5 // Consumidor Final

    if (esRI) {
      if (client?.client_type === 'distribuidor' || esCuitValido) {
        if (!esCuitValido) {
           // Si no tiene CUIT pero es distribuidor, lo dejamos pasar para el cálculo pero 
           // lanzará error si se elige Factura A
        }
        cbteTipo = 1 // Factura A
        docTipo = 80 // CUIT
        docNro = parseInt(cuitLimpio) || 0
        condicionIvaReceptor = 1 // Responsable Inscripto
      } else {
        cbteTipo = 6 // Factura B
        docTipo = esCuitValido ? 80 : (esDniValido ? 96 : 99)
        docNro = cuitLimpio.length >= 7 ? parseInt(cuitLimpio) : 0
        condicionIvaReceptor = 5
      }
    } else {
      // Monotributista (Factura C)
      cbteTipo = 11
      docTipo = esCuitValido ? 80 : (esDniValido ? 96 : 99)
      docNro = cuitLimpio.length >= 7 ? parseInt(cuitLimpio) : 0
      condicionIvaReceptor = esCuitValido ? 1 : 5
    }

    // Aplicar Override del usuario si existe y es válido
    if (cbteTipoOverride) {
      if (esRI && cbteTipoOverride === 11) throw new Error('Un Responsable Inscripto no puede emitir Factura C')
      if (!esRI && cbteTipoOverride !== 11) throw new Error('Un Monotributista solo puede emitir Factura C')
      
      cbteTipo = cbteTipoOverride
      // Si el usuario fuerza Factura A, validamos CUIT sí o sí
      if (cbteTipo === 1 && !esCuitValido) throw new Error('Para Factura A es obligatorio un CUIT válido del cliente')
      
      // Ajustar docTipo/docNro según el nuevo cbteTipo si cambió la lógica
      if (cbteTipo === 1) {
         docTipo = 80
         docNro = parseInt(cuitLimpio)
         condicionIvaReceptor = 1
      } else if (cbteTipo === 6) {
         docTipo = esCuitValido ? 80 : (esDniValido ? 96 : 99)
         docNro = cuitLimpio.length >= 7 ? parseInt(cuitLimpio) : 0
         condicionIvaReceptor = 5
      }
    }

    // Convertir a tipo correctivo de AFIP si corresponde
    if (isCreditNote) {
      if (cbteTipo === 1) cbteTipo = 3   // Nota de Crédito A
      else if (cbteTipo === 6) cbteTipo = 8   // Nota de Crédito B
      else if (cbteTipo === 11) cbteTipo = 13 // Nota de Crédito C
    } else if (isDebitNote) {
      if (cbteTipo === 1) cbteTipo = 2   // Nota de Débito A
      else if (cbteTipo === 6) cbteTipo = 7   // Nota de Débito B
      else if (cbteTipo === 11) cbteTipo = 12 // Nota de Débito C
    }

    // Aplicar adición de IVA si addIva es true, corresponde y no hay borrador previo ya calculado
    if (addIva && !existingDraft && (cbteTipo === 1 || cbteTipo === 6 || cbteTipo === 3 || cbteTipo === 8 || cbteTipo === 2 || cbteTipo === 7)) {
      montoTotal = parseFloat((montoTotal * 1.21).toFixed(2));
    }

    // Validación final de montos según tipo de comprobante (A, B y C tienen límites)
    if (cbteTipo !== 1 && cbteTipo !== 3 && cbteTipo !== 2 && montoTotal > LIMITE_IDENTIFICACION && docTipo === 99) {
       throw new Error(`Para montos mayores a $${LIMITE_IDENTIFICACION.toLocaleString()} es obligatorio identificar al cliente con DNI/CUIT`)
    }

    // 6. Preparar datos del voucher
    const voucherData: any = {
      CantReg: 1,
      PtoVta: Number(config.punto_venta) || 2,
      CbteTipo: cbteTipo,
      Concepto: businessType === 'services' ? 2 : 1, // 1: Productos, 2: Servicios
      DocTipo: docTipo,
      DocNro: docNro,
      CbteFch: new Date().toISOString().replace(/-/g, '').split('T')[0],
      ImpTotal: montoTotal,
      ImpTotConc: 0,
      ImpNeto: cbteTipo === 1 || cbteTipo === 6 || cbteTipo === 3 || cbteTipo === 8 || cbteTipo === 2 || cbteTipo === 7
        ? parseFloat((montoTotal / 1.21).toFixed(2)) 
        : montoTotal,
      ImpOpEx: 0,
      ImpIVA: cbteTipo === 1 || cbteTipo === 6 || cbteTipo === 3 || cbteTipo === 8 || cbteTipo === 2 || cbteTipo === 7
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

    // Agregar comprobante asociado oficial de AFIP
    if (esCorrectivo && budget.afip_comprobante_numero) {
      voucherData.CbtesAsoc = [{
        Tipo: budget.afip_comprobante_tipo || (esRI ? (client?.client_type === 'distribuidor' || esCuitValido ? 1 : 6) : 11),
        PtoVta: Number(config.punto_venta) || 2,
        Nro: budget.afip_comprobante_numero
      }]
    }

    // 7. Solicitar CAE
    let result: any;
    try {
      result = await arca.electronicBillingService.createNextVoucher(voucherData)
    } catch (error: any) {
      console.error('Error al solicitar CAE de forma directa:', error)
      const fullErrorText = (
        (error.message || '') + 
        (error.response?.data?.message || '') + 
        (error.body?.message || '') +
        (error.faultstring || '') +
        (error.toString?.() || '')
      ).toLowerCase()

      const isAlreadyAuth = 
        fullErrorText.includes('alreadyauthenticated') || 
        fullErrorText.includes('cee ya posee un ta valido')

      if (isAlreadyAuth) {
        let credentialsToUse: any = null
        
        if (cachedTicket && cachedTicket.credentials) {
          credentialsToUse = cachedTicket.credentials
        } else {
          // Check disk
          const cuitClean = config.cuit.replace(/-/g, '')
          const ticketFileName = `TA-${cuitClean}-wsfe.json`
          const ticketFilePath = path.join(os.tmpdir(), 'arca-tickets-stable', ticketFileName)
          if (fs.existsSync(ticketFilePath)) {
            try {
              const ticketData = JSON.parse(fs.readFileSync(ticketFilePath, 'utf8'))
              credentialsToUse = {
                header: ticketData.header,
                credentials: ticketData.credentials
              }
            } catch (e) {}
          }
        }

        if (credentialsToUse) {
          console.log('WSAA reported alreadyAuthenticated. Force-reusing existing credentials.')
          const arcaRetry = new Arca({
            key: cleanKey,
            cert: actualCert,
            cuit: parseInt(config.cuit.replace(/-/g, '')),
            production: !config.is_sandbox,
            credentials: credentialsToUse,
            handleTicket: true,
            useHttpsAgent: true
          })
          result = await arcaRetry.electronicBillingService.createNextVoucher(voucherData)
        } else {
          throw error
        }
      } else {
        throw error
      }
    }

    const resDet = result.response?.FeDetResp?.FECAEDetResponse?.[0]
    const status = result.response?.FeCabResp?.Resultado || result.Resultado
    const cae = result.cae || result.CAE || resDet?.CAE
    const caeFchVto = result.caeFchVto || result.CAEFchVto || resDet?.CAEFchVto
    const cbteNro = result.cbteDesde || result.CbteDesde || resDet?.CbteDesde

    if (status !== 'A') {
      const obs = resDet?.Observaciones?.Obs?.[0]?.Msg || result.Observaciones?.Obs?.[0]?.Msg
      const err = result.Errors?.Err?.[0]?.Msg || result.response?.Errors?.Err?.[0]?.Msg
      const msg = obs || err || `Error ARCA (Status ${status})`
      throw new Error(msg)
    }

    // Cache ticket in database if we obtained a new one
    if (!isTicketValid) {
      const cuitClean = config.cuit.replace(/-/g, '')
      const ticketFileName = `TA-${cuitClean}-wsfe.json`
      const ticketFilePath = path.join(os.tmpdir(), 'arca-tickets-stable', ticketFileName)
      if (fs.existsSync(ticketFilePath)) {
        try {
          const ticketContent = fs.readFileSync(ticketFilePath, 'utf8')
          const ticketData = JSON.parse(ticketContent)
          const expirationStr = ticketData.header?.[1]?.expirationtime
          if (expirationStr) {
            const expiresAt = new Date(expirationStr).getTime()
            const payload = {
              credentials: {
                header: ticketData.header,
                credentials: ticketData.credentials
              },
              production: !config.is_sandbox,
              expiresAt
            }
            const updatedCertContent = `${actualCert}\n===WSAA_TICKET===\n${JSON.stringify(payload)}`
            await supabaseAdmin
              .from('afip_configs')
              .update({ cert_content: updatedCertContent })
              .eq('company_id', budget.company_id)
            console.log('Successfully cached WSAA ticket in database after voucher generation.')
          }
        } catch (err) {
          console.error('Failed to cache ticket in database:', err)
        }
      }
    }

    // 8. Actualización Dual o Inserción de Comprobante Correctivo
    if (esCorrectivo) {
      if (isCreditNote) {
        // Anular la factura original solo si es anulación total (sin customAmount o igual/mayor al total)
        const esAnulacionTotal = !customAmount || Number(customAmount) >= Number(budget.total_amount)
        if (esAnulacionTotal) {
          await supabaseAdmin
            .from('invoices')
            .update({ status: 'cancelled' })
            .eq('budget_id', budget_id)
            .eq('status', 'emitted')
        }
      }

      // Insertar el nuevo comprobante correctivo en la tabla invoices
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
          invoice_date: new Date().toISOString().split('T')[0],
          invoice_number: cbteNro,
          ...(businessType === 'services' ? {
            afip_servicio_desde: voucherData.FchServDesde,
            afip_servicio_hasta: voucherData.FchServHasta,
            afip_servicio_vto: voucherData.FchVtoPago
          } : {})
        })
    } else {
      // Flujo de factura estándar (guardado dual original)
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

      await supabaseAdmin
        .from('invoices')
        .update({
          status: 'emitted',
          total_amount: montoTotal,
          afip_cae: cae,
          afip_cae_vencimiento: caeFchVto,
          afip_comprobante_numero: cbteNro,
          afip_comprobante_tipo: cbteTipo,
          ...(businessType === 'services' ? {
            afip_servicio_desde: voucherData.FchServDesde,
            afip_servicio_hasta: voucherData.FchServHasta,
            afip_servicio_vto: voucherData.FchVtoPago
          } : {})
        })
        .eq('budget_id', budget_id);

      if (addIva && !existingDraft) {
        const { data: inv } = await supabaseAdmin
          .from('invoices')
          .select('id')
          .eq('budget_id', budget_id)
          .single();
        
        if (inv) {
          const { data: items } = await supabaseAdmin
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', inv.id);
          
          if (items) {
            for (const item of items) {
              await supabaseAdmin
                .from('invoice_items')
                .update({
                  unit_price: parseFloat((item.unit_price * 1.21).toFixed(2)),
                  total: parseFloat((item.total * 1.21).toFixed(2))
                })
                .eq('id', item.id);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      cae: cae,
      invoice_number: cbteNro,
      message: 'Factura emitida con éxito'
    })

  } catch (error: any) {
    console.error('Error emitiendo factura:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al emitir factura'
    }, { status: 500 })
  } finally {
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath)
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath)
  }
}
