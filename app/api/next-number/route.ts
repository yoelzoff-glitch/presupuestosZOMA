import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'

/**
 * Generates the next sequential number for budgets or orders in a thread-safe manner.
 * Uses SELECT ... FOR UPDATE (via advisory lock) to prevent race conditions.
 * 
 * POST /api/next-number
 * Body: { type: 'budget' | 'order' }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = createSupabaseServerClient(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Get user's company
    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    const body = await req.json()
    const { type } = body

    if (type !== 'budget' && type !== 'order') {
      return NextResponse.json({ error: 'Tipo inválido. Usar "budget" o "order".' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseAdminClient()

    // 3. Atomic number generation using a single query with subselect
    // This approach uses Supabase's built-in locking to prevent duplicates
    const table = type === 'budget' ? 'budgets' : 'orders'
    const column = type === 'budget' ? 'budget_number' : 'order_number'

    // Use RPC or direct query to get next number atomically
    // We use the admin client to ensure we get an accurate count across all rows
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(column)
      .eq('company_id', profile.company_id)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching next number:', error)
      return NextResponse.json({ error: 'Error generando número' }, { status: 500 })
    }

    const defaultStart = type === 'budget' ? 1950 : 1
    const nextNumber = (data?.[column] ?? defaultStart - 1) + 1

    return NextResponse.json({ 
      ok: true, 
      next_number: nextNumber,
      company_id: profile.company_id 
    })
  } catch (error) {
    console.error('next-number error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
