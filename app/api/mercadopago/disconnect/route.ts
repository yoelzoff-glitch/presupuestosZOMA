import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { company_id } = body

  if (!company_id) {
    return NextResponse.json({ error: 'Falta company_id' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('mp_accounts')
    .update({
      connected: false,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', company_id)

  if (error) {
    return NextResponse.json(
      { error: 'No se pudo desconectar Mercado Pago', detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}