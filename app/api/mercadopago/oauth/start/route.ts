import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    )
  }

  const token = authHeader.replace('Bearer ', '')

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token)

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Usuario inválido' },
      { status: 401 }
    )
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.company_id) {
    return NextResponse.json(
      { error: 'No se encontró company_id' },
      { status: 400 }
    )
  }

  const clientId = process.env.MERCADOPAGO_CLIENT_ID
  const redirectUri = process.env.MERCADOPAGO_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Faltan variables de entorno de Mercado Pago' },
      { status: 500 }
    )
  }

  const authUrl = new URL(
    'https://auth.mercadopago.com.ar/authorization'
  )

  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('platform_id', 'mp')
  authUrl.searchParams.set('redirect_uri', redirectUri)

  authUrl.searchParams.set(
    'state',
    profile.company_id
  )

  return NextResponse.redirect(authUrl.toString())
}