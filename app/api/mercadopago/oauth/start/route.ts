import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('company_id')

  if (!companyId) {
    return NextResponse.json(
      { error: 'Falta company_id' },
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

  const authUrl = new URL('https://auth.mercadopago.com.ar/authorization')

  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('platform_id', 'mp')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', companyId)

  return NextResponse.redirect(authUrl.toString())
}