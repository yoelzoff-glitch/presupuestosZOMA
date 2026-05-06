import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type MpAccount = {
  company_id: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
}

export async function getValidMercadoPagoAccessToken(
  companyId: string
): Promise<string | null> {
  const { data: account, error } = await supabaseAdmin
    .from('mp_accounts')
    .select('company_id, access_token, refresh_token, expires_at')
    .eq('company_id', companyId)
    .eq('connected', true)
    .single<MpAccount>()

  if (error || !account) return null

  const now = Date.now()
  const expiresAt = account.expires_at
    ? new Date(account.expires_at).getTime()
    : 0

  const fiveMinutes = 5 * 60 * 1000
  const stillValid = expiresAt && expiresAt - now > fiveMinutes

  if (stillValid) {
    return account.access_token
  }

  if (!account.refresh_token) {
    return null
  }

  const clientId = process.env.MERCADOPAGO_CLIENT_ID
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return null
  }

  const tokenResponse = await fetch(
    'https://api.mercadopago.com/oauth/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: account.refresh_token,
      }),
    }
  )

  const tokenData = await tokenResponse.json()

  if (!tokenResponse.ok) {
    console.error('MP refresh token error:', tokenData)
    return null
  }

  const newExpiresAt = new Date(
    Date.now() + Number(tokenData.expires_in || 0) * 1000
  ).toISOString()

  const { error: updateError } = await supabaseAdmin
    .from('mp_accounts')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || account.refresh_token,
      public_key: tokenData.public_key,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      expires_at: newExpiresAt,
      scope: tokenData.scope,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)

  if (updateError) {
    console.error('MP refresh update error:', updateError)
    return null
  }

  return tokenData.access_token
}