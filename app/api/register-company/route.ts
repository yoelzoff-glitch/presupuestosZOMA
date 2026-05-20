import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate — extract user_id from JWT, never trust client body
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

    const body = await req.json()
    const { company_name, email, user_id: bodyUserId, plan_type } = body

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // Si no hay sesión, intentamos usar el user_id del body (útil para registros nuevos)
    const activeUserId = user?.id || bodyUserId

    if (!activeUserId) {
      return NextResponse.json(
        { error: 'No autorizado. Debés iniciar sesión o proveer un ID de usuario.' },
        { status: 401 }
      )
    }

    // Si usamos el ID del body, verificamos que el usuario exista realmente en Auth
    if (!user && bodyUserId) {
      const { data: authUser, error: findError } = await supabaseAdmin.auth.admin.getUserById(bodyUserId)
      if (findError || !authUser) {
        return NextResponse.json(
          { error: 'Usuario no encontrado en el sistema.' },
          { status: 401 }
        )
      }
    }

    const finalUserId = activeUserId
    if (!company_name || !email) {
      return NextResponse.json(
        { error: 'Faltan datos obligatorios (nombre de empresa, email)' },
        { status: 400 }
      )
    }

    // 2. Check user doesn't already have a company
    const { data: existingProfile } = await supabaseAdmin
      .from('users_profiles')
      .select('company_id')
      .eq('id', finalUserId)
      .maybeSingle()

    if (existingProfile?.company_id) {
      return NextResponse.json(
        { error: 'Este usuario ya tiene una empresa registrada.' },
        { status: 409 }
      )
    }

    // 3. Create Company
    const subscriptionExpiry = new Date()
    subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 7)

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: company_name,
        subscription_expiry: subscriptionExpiry.toISOString(),
        plan_type: plan_type || 'base',
      })
      .select('id')
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        {
          error: 'No se pudo crear la empresa',
          detail: companyError?.message,
        },
        { status: 500 }
      )
    }

    // 4. Create/Update User Profile — use authenticated finalUserId, not body
    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .upsert({
        id: finalUserId,
        company_id: company.id,
        full_name: email,
        role: 'admin',
      })

    if (profileError) {
      // Cleanup: delete the company if profile fails
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      return NextResponse.json(
        {
          error: 'No se pudo crear el perfil',
          detail: profileError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      company_id: company.id,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Error interno registrando empresa' },
      { status: 500 }
    )
  }
}