import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/notifications/order-cancelled
 * ------------------------------------------------------------
 * Creates a notification when an order is cancelled by the customer.
 *
 * Security fix:
 *   - Verifies user authentication.
 *   - Ensures the notification is created for the correct company.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })
    }

    const body = await req.json()
    const companyId = String(body.companyId || '').trim()
    const orderId = String(body.orderId || '').trim()
    const orderCode = String(body.orderCode || '').trim()
    const customerName = String(body.customerName || '').trim()

    if (!companyId || !orderId || !orderCode) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    if (companyId !== profile.company_id) {
       return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 })
    }

    const { error } = await supabaseAdmin.from('notifications').insert({
      company_id: profile.company_id,
      title: 'Pedido cancelado por cliente',
      message: `${customerName || 'Un cliente'} canceló el pedido ${orderCode} desde el portal.`,
      type: 'order',
      link: `/pedidos/${orderId}`,
      read: false,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error creando notificación:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}