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
    const cleanKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCNjDA9k2+us9QM
UEn19nrI2EBjQzmTnHSozLnERV2YDvm3Nd/qaNhP4xFi7M4DspogUkR9I20GSVBc
nHl0H38OHIOPKozhoqSwtlOQzX1vGuEnLq/CoOKdMSAvu5wBmBFdepk3bUkrjosq
lDDI2HppB2EW9Dl1fW5yCsClP+SGEIQ1MYqfyy1mLJSNTtOTZmcqjFRAkGAASGrY
dnvRV7qDCSYIpuo6tmE/U8yrva1qm1YBMlIa9kjYCkIuWpzKiHdADacJLlUFZhub
DudwuQcDnGvp3o8tFRd1h1E2XRrMXf44m4dB+BKGzdGmqkPM2SzAyPDcis9eAMdb
FKMjYCoHAgMBAAECggEAICJ//zK+K6Ti0qrVp7P9+yPxNjfYVfUynPHhiLgQwAlC
UwA1phOIbFaKJ3HIcZl2GTlkGB7XTRKO3n+dqSnPYAZELdgEpOMWTZIPFbQ5MmSh
UhJsz5xT5kj1XDDVAZ2i75x6NVWnw244lQGQs8BFxhtpRNtMQiqoTNa5FqsTOAYo
bssvshzYekvPizpw1zCzP3PT3GWuLFD6QH1L+ldKintIIQhOXu/BDTzMvRCQacKG
7GTReV9fhreKz+qHw5m3AMfpt/uNUvlBj/3fxEx1so3Fw6DzbP601XLkG/N8QEbT
ScSrHQX/3/jHUJ1mInYH5Um2wKr3XQB+nKMbeQ5nHQKBgQDDiFEiAjt0Zt4aCiij
JXVI/er1p9REDik3w1Ywy99/VWJTQDy5+tCLrQgPeOyRy4hL+7g3hI1lVcYCZKxA
lhb7eTH3Y3zRcMXdG5iAhuS2A8Z3EbJLreOGTfU1AY8usCZ5BT57J1tXvAClnv1S
vGYw0MycStuUDjVkx6Mx7483DQKBgQC5Ug+jr+/O5ew1g/MT1K2r2KESVeoZhRFC
8D6B5cwc1K6q3AWuW2h4poHENCUkfn7q90K4S3Z959mQCZh6xxlr1eFmBj/AQdip
f3sWEV+gCPkCHKqbTNizZohI12iMqfERr7HtO6eLn1G0hMkaiIBdQgWsKsNI567m
BOnFTX1gYwKBgARe8rlY5W1Xs1VPrtLezn1gN7VgGA2hZ2h4tF+I3ykghn8n63OY
2LqWlpyJ7nff3d8c9GRBUUvXnAKHr5YOBNuAPQ6zqaGg7Lthl4of+dLbyL72pU6t
x21EJtwVedboVyPTay8jlRYj/Lu3DyCfV4V11W0U+02W97iWAd7m5QOtAoGAH6jB
OzmHQlVNMSdFk5G1ybHMcpFy2ME+3aylQRO89v/uhwnnfo3nHxVy/c3auo1RqVps
b4eUypWdOVoqTm9NDHsRcpiGs5WMKgi5Ql/dcj2WLKIxEy7hpmRRy//gwIcXw+m7
/8c9LEEfeDNnF71SEJyC05LKod3Sp0EXnrlKPfkCgYEAl+ZiSXwEfnqAhHg9DETE
HEovtd37XVK2HD+d0wWyTh9RSy7H1QaNMxJuoGAL5ZAUshFNZYGffuPPiLZ7XOfZ
dCB0/MTj37B7iwJpmUGDwri/8R9vsYOA2NbcnD90DC5x+AYrr/eYvWJN7vRf+deO
t27ebkdGxxFaQgZ3nLBA7mQ=
-----END PRIVATE KEY-----`

    const cleanCert = config.cert_content.replace(/\r\n/g, '\n').trim()

    const arca = new Arca({
      key: cleanKey,
      cert: cleanCert,
      cuit: parseInt(config.cuit.replace(/-/g, '')),
      production: !config.is_sandbox
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
