import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

// Supabase admin client (service role)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/mercadopago/status
 * ------------------------------------------------------------
 * Returns the Mercado Pago connection status for the current company.
 *
 * Security fix:
 *   - Authenticates the user.
 *   - Retrieves the company_id from the session profile.
 *   - Prevents unauthorized access to other companies' keys.
 */
export async function GET(req: NextRequest) {
  // 1. Create a server-side client
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

  // 3. Get company_id from profile
  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.company_id) {
    return NextResponse.json(
      { error: 'No se encontró una empresa asociada' },
      { status: 403 }
    )
  }

  const company_id = profile.company_id

  // 4. Query status using verified company_id
  const { data, error } = await supabaseAdmin
    .from('mp_accounts')
    .select('mp_user_id, public_key, connected, updated_at')
    .eq('company_id', company_id)
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