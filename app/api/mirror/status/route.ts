import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
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
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('plan_type')
      .eq('id', profile.company_id)
      .single()

    const planType = company?.plan_type || 'base'
    const isPro = planType !== 'base'

    // Verificar si el usuario actual es espejo
    const { data: mirrorLink } = await supabaseAdmin
      .from('mirror_accounts')
      .select('mirror_email, is_active')
      .eq('mirror_user_id', user.id)
      .maybeSingle()

    // Verificar si el usuario actual es primario y tiene espejo
    const { data: primaryLink } = await supabaseAdmin
      .from('mirror_accounts')
      .select('mirror_email, is_active')
      .eq('primary_user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      isMirrorUser: !!mirrorLink,
      isMirrorActive: mirrorLink ? mirrorLink.is_active : (primaryLink ? primaryLink.is_active : false),
      hasMirrorAccount: !!primaryLink,
      mirrorEmail: mirrorLink ? mirrorLink.mirror_email : (primaryLink ? primaryLink.mirror_email : null),
      isPro
    })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Error interno del servidor', detail: error.message }, { status: 500 })
  }
}
