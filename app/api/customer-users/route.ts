import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const name = String(body.name || '').trim()
    const username = String(body.username || '').trim().toLowerCase()
    const password = String(body.password || '').trim()
    const companyId = String(body.companyId || '').trim()

    if (!name || !username || !password || !companyId) {
      return NextResponse.json(
        { error: 'Faltan datos obligatorios.' },
        { status: 400 }
      )
    }

    const email = username.includes('@')
      ? username
      : `${username}@clientes.local`

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

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role: 'customer',
        },
      })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'No se pudo crear el usuario.' },
        { status: 400 }
      )
    }

    const authUserId = authData.user.id

    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .insert({
        id: authUserId,
        company_id: companyId,
        role: 'customer',
      })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId)

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      )
    }

    const { error: customerError } = await supabaseAdmin
      .from('customer_users')
      .insert({
        name,
        email,
        company_id: companyId,
        auth_user_id: authUserId,
        active: true,
      })

    if (customerError) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId)

      return NextResponse.json(
        { error: customerError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: authUserId,
        name,
        username,
        email,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error interno al crear el usuario cliente.' },
      { status: 500 }
    )
  }
}