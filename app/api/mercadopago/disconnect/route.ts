import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

// Supabase admin client (service role) – used only after we verify ownership
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/mercadopago/disconnect
 * ------------------------------------------------------------
 * Disconnects a Mercado Pago account from the current company.
 *
 * Security fix:
 *   - Authenticates the user via cookies.
 *   - Retrieves the company_id from the user's profile.
 *   - Ignores any company_id passed in the body to prevent unauthorized disconnects.
 */
export async function POST(req: NextRequest) {
  // 1. Create a server-side client to check authentication
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

  // 2. Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // 3. Get company_id from the profile
  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.company_id) {
    return NextResponse.json(
      { error: 'No se encontró una empresa asociada a este usuario' },
      { status: 403 }
    )
  }

  const company_id = profile.company_id

  // 4. Update the mp_accounts table using the admin client
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