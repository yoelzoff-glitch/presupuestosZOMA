import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usamos el Service Role para poder saltarnos el RLS,
// ya que el cliente que ve el PDF público no está logueado en el sistema.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { budgetId } = await req.json()

    if (!budgetId) {
      return NextResponse.json({ error: 'Falta el ID del presupuesto' }, { status: 400 })
    }

    // Actualizamos la fecha de última vista
    const { error } = await supabaseAdmin
      .from('budgets')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', budgetId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error tracking budget view:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
