import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Admin
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

    const { data: { user: adminUser } } = await supabase.auth.getUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role, company_id')
      .eq('id', adminUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Permiso denegado', 
        detail: `Tu rol actual es: "${profile?.role || 'No definido'}" y el sistema requiere "admin".` 
      }, { status: 403 })
    }

    // Validate PRO plan server-side — BASE plan cannot create vendedores
    const { data: company } = await supabase
      .from('companies')
      .select('plan_type')
      .eq('id', profile.company_id)
      .single()

    const planType = company?.plan_type || 'base'
    if (planType !== 'pro' && planType !== 'pro_plus') {
      return NextResponse.json({ 
        error: 'Función no disponible', 
        detail: 'La creación de vendedores requiere un plan PRO o superior. Actualizá tu plan desde Configuración.' 
      }, { status: 403 })
    }

    const body = await req.json()
    const { email, password, full_name } = body

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Faltan datos (email, password, nombre)' }, { status: 400 })
    }

    // 2. Create User in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Error creando usuario de autenticación', detail: authError?.message }, { status: 400 })
    }

    // 3. Create/Update User Profile (Upsert to handle trigger)
    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .upsert({
        id: authData.user.id,
        company_id: profile.company_id,
        full_name,
        role: 'vendedor'
      })

    if (profileError) {
      // Cleanup auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ 
        error: 'Error creando perfil en DB', 
        detail: profileError.message,
        code: profileError.code
      }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user_id: authData.user.id })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
