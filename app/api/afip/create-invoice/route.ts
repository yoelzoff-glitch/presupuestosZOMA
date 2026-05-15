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

    // 1. Obtener datos del presupuesto
    const { data: budget, error: bError } = await supabaseAdmin
      .from('budgets')
      .select('*, budget_items(*)')
      .eq('id', budget_id)
      .single()

    if (bError || !budget) throw new Error('Presupuesto no encontrado')
    if (budget.afip_cae) throw new Error('Este presupuesto ya tiene una factura emitida')

    // 2. Obtener config fiscal
    const { data: config, error: cError } = await supabaseAdmin
      .from('afip_configs')
      .select('*')
      .eq('company_id', budget.company_id)
      .single()

    if (cError || !config) throw new Error('Configuración fiscal no encontrada')

    console.log('Facturando para Company:', budget.company_id)
    console.log('Usando Config ID:', config.id)
    console.log('Cert starts with:', config.cert_content?.substring(0, 20))
    console.log('Key starts with:', config.key_content?.substring(0, 20))

    // 3. Inicializar ARCA directamente con los strings normalizados
    const cleanKey = config.key_content.replace(/\r\n/g, '\n').trim()
    const cleanCert = config.cert_content.replace(/\r\n/g, '\n').trim()

    const arca = new Arca({
      key: cleanKey,
      cert: cleanCert,
      cuit: parseInt(config.cuit.replace(/-/g, '')),
      production: !config.is_sandbox,
      ticketPath: path.join(os.tmpdir(), 'arca-tickets-stable')
    })

    // 5. Determinar tipo de comprobante (Ej: 11 para Factura C Monotributo)
    const cbteTipo = config.tipo_contribuyente === 'monotributo' ? 11 : 1 // 11=C, 1=A (simplificado)
    const puntoVenta = config.punto_venta

    // 6. Preparar datos del voucher (Usamos createNextVoucher que calcula el número solo)
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
    
    const voucherData = {
      CantReg: 1,
      PtoVta: puntoVenta,
      CbteTipo: cbteTipo,
      Concepto: 1, // 1=Productos
      DocTipo: 99, // 99=Sin identificar (Consumidor Final)
      DocNro: 0,
      CbteFch: date,
      ImpTotal: Number(budget.total_amount),
      ImpTotConc: 0,
      ImpNeto: Number(budget.total_amount),
      ImpOpEx: 0,
      ImpIVA: 0,
      ImpTrib: 0,
      MonId: 'PES',
      MonCotiz: 1,
      CondicionIVAReceptorId: 5 // 5 = Consumidor Final
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
    const status = result.response?.FeCabResp?.Resultado || result.Resultado
    const cae = result.cae || result.CAE || result.response?.FeDetResp?.FECAEDetResponse?.[0]?.CAE
    const caeFchVto = result.caeFchVto || result.CAEFchVto || result.response?.FeDetResp?.FECAEDetResponse?.[0]?.CAEFchVto
    const cbteNro = result.cbteDesde || result.CbteDesde || result.response?.FeDetResp?.FECAEDetResponse?.[0]?.CbteDesde

    if (status !== 'A') {
      const obs = result.response?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs?.[0]?.Msg || result.Observaciones?.Obs?.[0]?.Msg
      const err = result.Errors?.Err?.[0]?.Msg
      const msg = obs || err || `Error ARCA: ${JSON.stringify(result).substring(0, 100)}...`
      throw new Error(msg)
    }

    // 9. Actualizar presupuesto en Supabase
    const { error: updateError } = await supabaseAdmin
      .from('budgets')
      .update({
        afip_cae: cae,
        afip_cae_vencimiento: caeFchVto,
        afip_comprobante_numero: cbteNro,
        afip_comprobante_tipo: cbteTipo,
        status: 'facturado'
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
