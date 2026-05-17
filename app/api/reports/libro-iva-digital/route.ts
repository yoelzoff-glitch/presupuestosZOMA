import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// Rellenar texto con espacios a la derecha
function padSpaces(text: string, length: number): string {
  const clean = (text || '').substring(0, length);
  return clean.padEnd(length, ' ');
}

// Rellenar número con ceros a la izquierda
function padZeros(value: number | string, length: number): string {
  const clean = String(value || '').replace(/[.-]/g, '');
  return clean.substring(0, length).padStart(length, '0');
}

// Formatear montos para AFIP (multiplicados por 100, sin puntos ni comas, 15 de longitud)
function formatAfipAmount(amount: number): string {
  const rounded = Math.round(amount * 100);
  const positiveVal = Math.abs(rounded);
  return padZeros(positiveVal, 15);
}

export async function POST(request: Request) {
  try {
    const { company_id, fecha_desde, fecha_hasta } = await request.json()
    if (!company_id) return NextResponse.json({ error: 'Falta company_id' }, { status: 400 })

    const supabaseAdmin = createSupabaseAdminClient()

    // 1. Obtener facturas del período
    const { data: invoices, error } = await supabaseAdmin
      .from('invoices')
      .select(`
        *,
        client:clients ( name, cuit )
      `)
      .eq('company_id', company_id)
      .neq('status', 'draft') // Ignorar borradores
      .gte('invoice_date', fecha_desde)
      .lte('invoice_date', fecha_hasta)
      .order('created_at', { ascending: true })

    if (error) throw error

    let lineasCabecera = ''
    let lineasAlicuotas = ''

    if (invoices && invoices.length > 0) {
      for (const f of invoices) {
        const fecha = f.invoice_date.replace(/-/g, '') // AAAAMMDD
        const tipoComp = padZeros(f.afip_comprobante_tipo || 11, 3)
        const ptoVta = padZeros(2, 5) // Punto de venta 00002
        const nroComp = padZeros(f.afip_comprobante_numero || f.invoice_number, 20)
        
        const cuit = f.client?.cuit?.replace(/-/g, '') || ''
        const esCuit = cuit.length === 11
        const docTipo = esCuit ? '80' : '99'
        const docNro = padZeros(cuit || 0, 11)
        const clientName = padSpaces(f.client?.name || 'CONSUMIDOR FINAL', 30)

        const total = Number(f.total_amount)
        const esNC = f.status === 'cancelled' || [3, 8, 13].includes(f.afip_comprobante_tipo)

        // Determinación de IVA según tipo de comprobante
        const esInscripto = [1, 6, 3, 8, 2, 7].includes(f.afip_comprobante_tipo || 0)
        const neto = esInscripto ? total / 1.21 : total
        const iva = esInscripto ? total - neto : 0
        const cantAlicuotas = esInscripto ? '1' : '0'

        // ==============================
        // GENERAR CABECERA (444 chars)
        // ==============================
        let cabecera = ''
        cabecera += fecha                                    // 1-8: Fecha Comprobante
        cabecera += tipoComp                                 // 9-11: Tipo Comprobante
        cabecera += ptoVta                                   // 12-16: Punto de Venta
        cabecera += nroComp                                  // 17-36: Número Desde
        cabecera += nroComp                                  // 37-56: Número Hasta
        cabecera += docTipo                                  // 57-58: Tipo Documento
        cabecera += docNro                                   // 59-69: Número Documento
        cabecera += clientName                               // 70-99: Nombre Comprador
        cabecera += formatAfipAmount(total)                  // 100-114: Importe Total
        cabecera += formatAfipAmount(0)                      // 115-129: Conceptos no gravados
        cabecera += formatAfipAmount(esInscripto ? neto : 0) // 130-144: Neto Gravado
        cabecera += formatAfipAmount(iva)                    // 145-159: Impuesto Liquidado (IVA)
        cabecera += formatAfipAmount(0)                      // 160-174: Operaciones Exentas
        cabecera += formatAfipAmount(0)                      // 175-189: Percepciones/Pagos a cuenta Nac
        cabecera += formatAfipAmount(0)                      // 190-204: Percepciones IIBB
        cabecera += formatAfipAmount(0)                      // 205-219: Percepciones Municipales
        cabecera += formatAfipAmount(0)                      // 220-234: Impuestos Internos
        cabecera += 'PES'                                    // 235-237: Código Moneda
        cabecera += '0001000000'                             // 238-247: Cotización Moneda
        cabecera += cantAlicuotas                            // 248-248: Cantidad de Alícuotas
        cabecera += ' '                                      // 249-249: Código Operación
        cabecera += formatAfipAmount(0)                      // 250-264: Otros Tributos
        cabecera += '00000000'                               // 265-272: Fecha Vencimiento Pago
        
        // Completar longitud exacta de 444 con espacios
        cabecera = cabecera.padEnd(444, ' ') + '\r\n'
        lineasCabecera += cabecera

        // ==============================
        // GENERAR ALÍCUOTAS (62 chars)
        // ==============================
        if (esInscripto) {
          let alicuota = ''
          alicuota += tipoComp                               // 1-3: Tipo Comprobante
          alicuota += ptoVta                                 // 4-8: Punto de Venta
          alicuota += nroComp                                // 9-28: Número de Comprobante
          alicuota += formatAfipAmount(neto)                 // 29-43: Neto Gravado
          alicuota += '0005'                                 // 44-47: Código Alícuota (21%)
          alicuota += formatAfipAmount(iva)                  // 48-62: Impuesto Liquidado
          
          alicuota = alicuota.padEnd(62, ' ') + '\r\n'
          lineasAlicuotas += alicuota
        }
      }
    }

    return NextResponse.json({
      success: true,
      cabecera: lineasCabecera,
      alicuotas: lineasAlicuotas
    })

  } catch (err: any) {
    console.error('Error generando Libro de IVA Digital:', err)
    return NextResponse.json({ success: false, error: err.message || 'Error del servidor' }, { status: 500 })
  }
}
