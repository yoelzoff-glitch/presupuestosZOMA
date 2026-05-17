import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'ID de factura requerido' }, { status: 400 })
    }

    // Usamos el cliente administrativo para saltar RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Borramos los ítems de la factura
    const { error: itemsError } = await supabaseAdmin
      .from('invoice_items')
      .delete()
      .eq('invoice_id', id)

    if (itemsError) throw itemsError

    // 2. Borramos la factura
    const { error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .delete()
      .eq('id', id)

    if (invoiceError) throw invoiceError

    return NextResponse.json({ success: true, message: 'Borrador eliminado permanentemente' })
  } catch (error: any) {
    console.error('Error en delete-draft:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
