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

  let authUserId: string | null = null

  try {
    const body = await req.json()

    const name = String(body.name || '').trim()
    const username = String(body.username || '').trim().toLowerCase()
    const password = String(body.password || '').trim()
    const companyId = String(body.companyId || '').trim()
    const clientId = String(body.clientId || '').trim()

    if (!name || !username || !password || !companyId || !clientId) {
      return NextResponse.json(
        { error: 'Faltan datos obligatorios.' },
        { status: 400 }
      )
    }

    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, cuit, active')
      .eq('id', clientId)
      .eq('company_id', companyId)
      .single()

    if (clientError || !clientData) {
      return NextResponse.json(
        { error: 'El cliente seleccionado no existe o no pertenece a la empresa.' },
        { status: 400 }
      )
    }

    if (clientData.active === false) {
      return NextResponse.json(
        { error: 'No se puede crear un acceso para un cliente inactivo.' },
        { status: 400 }
      )
    }

    const { data: existingCustomer } = await supabaseAdmin
      .from('customer_users')
      .select('id')
      .eq('company_id', companyId)
      .eq('client_id', clientId)
      .maybeSingle()

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'Este cliente ya tiene un usuario de portal asociado.' },
        { status: 400 }
      )
    }

    const email = username.includes('@')
      ? username
      : `${username}@clientes.local`

    const { data: existingEmail } = await supabaseAdmin
      .from('customer_users')
      .select('id')
      .eq('company_id', companyId)
      .eq('email', email)
      .maybeSingle()

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Ya existe un usuario cliente con ese email o usuario.' },
        { status: 400 }
      )
    }

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

    authUserId = authData.user.id

    // Usamos UPSERT atómico. Si el trigger ya lo creó, lo actualiza. Si no, lo inserta.
    // Esto evita errores de duplicado por condiciones de carrera.
    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .upsert({
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
        client_id: clientId,
        auth_user_id: authUserId,
        active: true,
      })

    if (customerError) {
      await supabaseAdmin.from('users_profiles').delete().eq('id', authUserId)
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
        clientId,
      },
    })
  } catch (error) {
    if (authUserId) {
      await supabaseAdmin.from('users_profiles').delete().eq('id', authUserId)
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
    }

    return NextResponse.json(
      { error: 'Error interno al crear el usuario cliente.' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
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
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 })
    }

    const { data: customer, error: fetchError } = await supabaseAdmin
      .from('customer_users')
      .select('auth_user_id')
      .eq('id', id)
      .single()

    if (fetchError || !customer) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    const authUserId = customer.auth_user_id
    await supabaseAdmin.from('customer_users').delete().eq('id', id)
    await supabaseAdmin.from('users_profiles').delete().eq('id', authUserId)
    await supabaseAdmin.auth.admin.deleteUser(authUserId)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Error en DELETE customer-users:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}