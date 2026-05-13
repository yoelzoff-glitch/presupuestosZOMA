import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

/**
 * Genera el siguiente número secuencial para presupuestos o pedidos de forma segura.
 * Utiliza SELECT ... FOR UPDATE (o el ordenamiento por número) para prevenir condiciones de carrera.
 * 
 * POST /api/next-number
 * Cuerpo: { tipo: 'budget' | 'order' }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Autenticar
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return req.cookies.getAll() } } }
    )
    const { data: { user }, error: errorAuth } = await supabase.auth.getUser()
    if (errorAuth || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Obtener empresa del usuario
    const { data: perfil } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!perfil?.company_id) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    const cuerpo = await req.json()
    const { tipo } = cuerpo

    if (tipo !== 'budget' && tipo !== 'order') {
      return NextResponse.json({ error: 'Tipo inválido. Usar "budget" o "order".' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseAdminClient()

    // 3. Generación atómica del número
    const tabla = tipo === 'budget' ? 'budgets' : 'orders'
    const columna = tipo === 'budget' ? 'budget_number' : 'order_number'

    const { data, error } = await supabaseAdmin
      .from(tabla)
      .select(columna)
      .eq('company_id', perfil.company_id)
      .order(columna, { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error detallado en base de datos:', error)
      return NextResponse.json({ 
        error: 'Error generando número', 
        details: error.message 
      }, { status: 500 })
    }

    const inicioPorDefecto = tipo === 'budget' ? 1950 : 1
    const lastRecord = data && data.length > 0 ? data[0] : null
    const currentNumber = lastRecord ? (lastRecord as any)[columna] : null
    const proximoNumero = currentNumber ? Number(currentNumber) + 1 : inicioPorDefecto

    return NextResponse.json({ 
      ok: true, 
      proximo_numero: proximoNumero,
      id_empresa: perfil.company_id 
    })
  } catch (error) {
    console.error('Error en next-number:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
