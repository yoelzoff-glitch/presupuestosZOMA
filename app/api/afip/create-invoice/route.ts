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
      ticketPath: path.join(os.tmpdir(), `arca-tickets-${Math.floor(Math.random() * 1000)}`)
    })

    // 5. Determinar tipo de comprobante (Ej: 11 para Factura C Monotributo)
    const cbteTipo = config.tipo_contribuyente === 'monotributo' ? 11 : 1 // 11=C, 1=A (simplificado)
    const puntoVenta = config.punto_venta

    // 6. Obtener último número autorizado
    const lastVoucher = await arca.electronicBillingService.getLastVoucher(puntoVenta, cbteTipo)
    const nextNumber = Number(lastVoucher) + 1

    // 7. Preparar datos del voucher
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
    
    const voucherData = {
      CantReg: 1,
      PtoVta: puntoVenta,
      CbteTipo: cbteTipo,
      Concepto: 1, // 1=Productos, 2=Servicios, 3=Productos y Servicios
      DocTipo: 99, // 99=Sin identificar (Consumidor Final)
      DocNro: 0,
      CbteDesde: nextNumber,
      CbteHasta: nextNumber,
      CbteFch: date,
      ImpTotal: budget.total_amount,
      ImpTotConc: 0,
      ImpNeto: budget.total_amount,
      ImpOpEx: 0,
      ImpIVA: 0,
      ImpTrib: 0,
      MonId: 'PES',
      MonCotiz: 1,
      CondicionIVAReceptorId: 5 // 5 = Consumidor Final
    }

    // 8. Solicitar CAE
    const result = await arca.electronicBillingService.createVoucher(voucherData as any) as any

    if (result.Resultado !== 'A') {
      const msg = result.Observaciones?.Obs?.[0]?.Msg || 'Error desconocido de ARCA'
      throw new Error(msg)
    }

    // 9. Actualizar presupuesto en Supabase
    const { error: updateError } = await supabaseAdmin
      .from('budgets')
      .update({
        afip_cae: result.CAE,
        afip_cae_vencimiento: result.CAEFchVto,
        afip_comprobante_numero: nextNumber,
        afip_comprobante_tipo: cbteTipo,
        status: 'facturado'
      })
      .eq('id', budget_id)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      cae: result.CAE,
      invoice_number: nextNumber,
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
