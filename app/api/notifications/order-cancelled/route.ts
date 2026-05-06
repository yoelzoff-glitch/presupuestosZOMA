import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  try {
    const body = await req.json()

    const companyId = String(body.companyId || '').trim()
    const orderId = String(body.orderId || '').trim()
    const orderCode = String(body.orderCode || '').trim()
    const customerName = String(body.customerName || '').trim()

    if (!companyId || !orderId || !orderCode) {
      return NextResponse.json(
        { error: 'Faltan datos para crear la notificación.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin.from('notifications').insert({
      company_id: companyId,
      title: 'Pedido cancelado por cliente',
      message: `${
        customerName || 'Un cliente'
      } canceló el pedido ${orderCode} desde el portal.`,
      type: 'order',
      link: `/pedidos/${orderId}`,
      read: false,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error creando notificación de cancelación:', error)

    return NextResponse.json(
      { error: 'Error interno al crear la notificación.' },
      { status: 500 }
    )
  }
}