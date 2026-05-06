import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, company_name, email } = body

    if (!user_id || !company_name || !email) {
      return NextResponse.json(
        { error: 'Faltan datos obligatorios' },
        { status: 400 }
      )
    }

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

    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .insert({
        id: user_id,
        company_id: company.id,
        full_name: email,
        role: 'admin',
      })

    if (profileError) {
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