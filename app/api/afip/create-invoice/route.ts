import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Arca } from '@arcasdk/core'
import fs from 'fs'
import path from 'path'
import os from 'os'

export async function POST(request: Request) {
  const tempDir = os.tmpdir()
  const certPath = path.join(tempDir, `cert_inv_${Date.now()}.crt`)
  const keyPath = path.join(tempDir, `key_inv_${Date.now()}.key`)

  try {
    const { budget_id } = await request.json()
    if (!budget_id) return NextResponse.json({ error: 'Falta budget_id' }, { status: 400 })

    const supabaseAdmin = createSupabaseAdminClient()

    // 1. Obtener datos del presupuesto e ítems (con datos del cliente)
    const { data: budget, error: bError } = await supabaseAdmin
      .from('budgets')
      .select('*, budget_items(*), clients(*)')
      .eq('id', budget_id)
      .single()

    if (bError || !budget) throw new Error('Presupuesto no encontrado')
    if (budget.afip_cae) throw new Error('Este presupuesto ya tiene una factura emitida')

    const client = Array.isArray(budget.clients) ? budget.clients[0] : budget.clients

    // 2. Obtener config fiscal
    const { data: config, error: cError } = await supabaseAdmin
      .from('afip_configs')
      .select('*')
      .eq('company_id', budget.company_id)
      .single()

    if (cError || !config) throw new Error('Configuración fiscal no encontrada')

    // 3. Inicializar ARCA
    const cleanKey = config.key_content.replace(/\r\n/g, '\n').trim()
    const cleanCert = config.cert_content.replace(/\r\n/g, '\n').trim()

    const arca = new Arca({
      key: cleanKey,
      cert: cleanCert,
      cuit: parseInt(config.cuit.replace(/-/g, '')),
      production: !config.is_sandbox,
      ticketPath: path.join(os.tmpdir(), 'arca-tickets-stable')
    })

    // 5. Determinar tipo de comprobante y lógica de IVA
    const esRI = config.tipo_contribuyente === 'responsable_inscripto'
    const cuitLimpio = client?.cuit?.replace(/-/g, '') || ''
    const esCuitValido = cuitLimpio.length === 11

    let cbteTipo = 11 // Por defecto Factura C (Monotributo)
    let docTipo = 99
    let docNro = 0
    let condicionIvaReceptor = 5 // Consumidor Final

    if (esRI) {
      if (esCuitValido) {
        cbteTipo = 1 // Factura A
        docTipo = 80 // CUIT
        docNro = parseInt(cuitLimpio)
        condicionIvaReceptor = 1 // Responsable Inscripto
      } else {
        cbteTipo = 6 // Factura B
        docTipo = 96 // DNI (si tiene) o 99
        docNro = cuitLimpio.length >= 7 ? parseInt(cuitLimpio) : 0
        if (cuitLimpio.length < 7) docTipo = 99
        condicionIvaReceptor = 5 // Consumidor Final
      }
    } else {
      // Monotributo
      cbteTipo = 11
      if (esCuitValido) {
        docTipo = 80
        docNro = parseInt(cuitLimpio)
        condicionIvaReceptor = 1
      } else if (cuitLimpio.length >= 7) {
        docTipo = 96
        docNro = parseInt(cuitLimpio)
      }
    }

    const puntoVenta = config.punto_venta
    const total = Number(budget.total_amount)

    // 6. Cálculos de IVA (Solo para Factura A y B)
    let impNeto = total
    let impIVA = 0
    let ivaArray: any[] = []

    if (esRI) {
      // Asumimos IVA 21% y que el total ya lo incluye (Desglosamos)
      impNeto = Number((total / 1.21).toFixed(2))
      impIVA = Number((total - impNeto).toFixed(2))
      ivaArray = [
        {
          Id: 5, // 21%
          BaseImp: impNeto,
          Importe: impIVA
        }
      ]
    }

    const date = new Date().toISOString().split('T')[0].replace(/-/g, '')

    const voucherData: any = {
      CantReg: 1,
      PtoVta: puntoVenta,
      CbteTipo: cbteTipo,
      Concepto: 1,
      DocTipo: docTipo,
      DocNro: docNro,
      CbteFch: date,
      ImpTotal: total,
      ImpTotConc: 0,
      ImpNeto: impNeto,
      ImpOpEx: 0,
      ImpIVA: impIVA,
      ImpTrib: 0,
      MonId: 'PES',
      MonCotiz: 1,
      CondicionIVAReceptorId: condicionIvaReceptor
    }

    if (ivaArray.length > 0) {
      voucherData.Iva = ivaArray
    }

    // 7. Solicitar CAE usando createNextVoucher (más robusto)
    let result: any;
    try {
      result = await arca.electronicBillingService.createNextVoucher(voucherData)
    } catch (error: any) {
      if (error.message.includes('alreadyAuthenticated')) {
        console.log('Reintentando con sesión limpia...')
        const arcaRetry = new Arca({
          key: cleanKey,
          cert: cleanCert,
          cuit: parseInt(config.cuit.replace(/-/g, '')),
          production: !config.is_sandbox,
          ticketPath: path.join(os.tmpdir(), `arca-retry-${Date.now()}`)
        })
        result = await arcaRetry.electronicBillingService.createNextVoucher(voucherData)
      } else {
        throw error
      }
    }

    // La respuesta del SDK tiene el Resultado dentro de response.FeCabResp
    const resDet = result.response?.FeDetResp?.FECAEDetResponse?.[0]
    const status = result.response?.FeCabResp?.Resultado || result.Resultado
    const cae = result.cae || result.CAE || resDet?.CAE
    const caeFchVto = result.caeFchVto || result.CAEFchVto || resDet?.CAEFchVto
    const cbteNro = result.cbteDesde || result.CbteDesde || resDet?.CbteDesde

    if (status !== 'A') {
      // Extraer mensaje de error más específico
      const obs = resDet?.Observaciones?.Obs?.[0]?.Msg || result.Observaciones?.Obs?.[0]?.Msg
      const err = result.Errors?.Err?.[0]?.Msg || result.response?.Errors?.Err?.[0]?.Msg
      const msg = obs || err || `Error ARCA (Status ${status}): ${JSON.stringify(result).substring(0, 200)}`
      throw new Error(msg)
    }

    // 9. Actualizar presupuesto en Supabase
    const { error: updateError } = await supabaseAdmin
      .from('budgets')
      .update({
        afip_cae: cae,
        afip_cae_vencimiento: caeFchVto,
        afip_comprobante_numero: cbteNro,
        afip_comprobante_tipo: cbteTipo
      })
      .eq('id', budget_id)

    if (updateError) throw updateError

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
