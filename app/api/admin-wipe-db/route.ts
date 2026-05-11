import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    console.log('--- INICIANDO LIMPIEZA DESDE API ---')

    // 1. Identificar a Yoel (PRESERVAR)
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError

    const yoel = users.users.find(u => u.email?.toLowerCase() === 'yoel.zoff@gmail.com')
    if (!yoel) return NextResponse.json({ error: 'No se encontró la cuenta de Yoel' }, { status: 404 })

    const { data: profile } = await supabaseAdmin
      .from('users_profiles')
      .select('company_id')
      .eq('id', yoel.id)
      .single()

    const yoelCompanyId = profile?.company_id

    // 2. Limpieza de tablas operativas
    const tables = [
      'budget_items',
      'budgets',
      'account_movements',
      'payments',
      'customers',
      'products',
      'notifications',
      'mp_accounts'
    ]

    for (const table of tables) {
      await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }

    // 3. Borrar otros usuarios
    for (const user of users.users) {
      if (user.id !== yoel.id) {
        await supabaseAdmin.auth.admin.deleteUser(user.id)
      }
    }

    // 4. Borrar otras empresas
    if (yoelCompanyId) {
      await supabaseAdmin.from('companies').delete().neq('id', yoelCompanyId)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Base de datos limpia. Se conservó el usuario Yoel y su empresa.' 
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
