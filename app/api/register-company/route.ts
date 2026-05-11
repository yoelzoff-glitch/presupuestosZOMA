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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado. Debés iniciar sesión primero.' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { company_name, email } = body

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
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfile?.company_id) {
      return NextResponse.json(
        { error: 'Este usuario ya tiene una empresa registrada.' },
        { status: 409 }
      )
    }

    // 3. Create Company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: company_name,
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

    // 4. Create/Update User Profile — use authenticated user.id, not body
    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .upsert({
        id: user.id,
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