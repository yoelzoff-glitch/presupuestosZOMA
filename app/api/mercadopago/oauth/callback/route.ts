import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const code = searchParams.get('code')
  const companyId = searchParams.get('state')

  if (!code || !companyId) {
    return NextResponse.json(
      { error: 'Faltan parámetros code o state' },
      { status: 400 }
    )
  }

  const clientId = process.env.MERCADOPAGO_CLIENT_ID
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET
  const redirectUri = process.env.MERCADOPAGO_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Faltan variables de entorno de Mercado Pago' },
      { status: 500 }
    )
  }

  const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  const tokenData = await tokenResponse.json()

  if (!tokenResponse.ok) {
    console.error('Mercado Pago OAuth error:', tokenData)

    return NextResponse.json(
      {
        error: 'No se pudo conectar Mercado Pago',
        detail: tokenData,
      },
      { status: 400 }
    )
  }
  const expiresAt = new Date(
    Date.now() + Number(tokenData.expires_in || 0) * 1000
  ).toISOString()

  const { error } = await supabaseAdmin
    .from('mp_accounts')
    .upsert(
      {
        company_id: companyId,
        mp_user_id: String(tokenData.user_id),
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        public_key: tokenData.public_key,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        scope: tokenData.scope,
        connected: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'company_id',
      }
    )

  if (error) {
    console.error('Supabase mp_accounts error:', error)

    return NextResponse.json(
      {
        error: 'Mercado Pago conectó, pero no se pudo guardar en la base',
        detail: error.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.redirect(
    `${req.nextUrl.origin}/configuracion?mp=connected`
  )
}