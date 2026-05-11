import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
      .select('company_id, full_name, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'vendedor') {
      return NextResponse.json({ error: 'Solo los vendedores pueden enviar estas notificaciones' }, { status: 403 })
    }

    const body = await req.json()
    const { budgetId, budgetCode, clientName } = body

    if (!budgetId || !budgetCode) {
      return NextResponse.json({ error: 'Faltan datos del presupuesto' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('notifications').insert({
      company_id: profile.company_id,
      title: 'Nuevo pedido de vendedor',
      message: `El vendedor ${profile.full_name} generó el presupuesto ${budgetCode} para ${clientName || 'un cliente'}.`,
      type: 'new_order',
      link: `/presupuestos/${budgetId}`,
      read: false,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error creando notificación de vendedor:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
