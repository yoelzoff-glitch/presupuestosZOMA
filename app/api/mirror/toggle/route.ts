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
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { is_active } = await req.json()

    const { data, error } = await supabaseAdmin
      .from('mirror_accounts')
      .update({ is_active: !!is_active })
      .eq('primary_user_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Error actualizando cuenta espejo', detail: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Error interno del servidor', detail: error.message }, { status: 500 })
  }
}
