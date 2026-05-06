import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('company_id')

  if (!companyId) {
    return NextResponse.json({ error: 'Falta company_id' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('mp_accounts')
    .select('mp_user_id, public_key, connected, updated_at')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: 'Error consultando Mercado Pago', detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    connected: Boolean(data?.connected),
    account: data || null,
  })
}