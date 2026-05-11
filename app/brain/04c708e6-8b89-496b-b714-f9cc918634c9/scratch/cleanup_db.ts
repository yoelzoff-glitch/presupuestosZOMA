import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function cleanup() {
  console.log('--- Iniciando Limpieza de Base de Datos ---')

  try {
    // 1. Identificar a Yoel
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError

    const yoel = users.users.find(u => u.email?.toLowerCase() === 'yoel.zoff@gmail.com')
    if (!yoel) throw new Error('No se encontró la cuenta de Yoel para preservar.')

    const { data: profile } = await supabaseAdmin
      .from('users_profiles')
      .select('company_id')
      .eq('id', yoel.id)
      .single()

    const yoelCompanyId = profile?.company_id
    console.log(`Preservando Usuario: ${yoel.id} y Empresa: ${yoelCompanyId}`)

    // 2. Borrar datos operativos (ordenados por dependencias)
    console.log('Borrando datos operativos...')
    await supabaseAdmin.from('budget_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('budgets').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('account_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('mp_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // 3. Borrar otros usuarios de Auth y Perfiles
    console.log('Borrando otros usuarios...')
    for (const user of users.users) {
      if (user.id !== yoel.id) {
        await supabaseAdmin.auth.admin.deleteUser(user.id)
        console.log(`Usuario eliminado: ${user.email}`)
      }
    }

    // 4. Borrar otras empresas
    if (yoelCompanyId) {
      console.log('Borrando otras empresas...')
      const { error: compError } = await supabaseAdmin
        .from('companies')
        .delete()
        .neq('id', yoelCompanyId)
      if (compError) console.error('Error borrando empresas:', compError.message)
    }

    console.log('--- Limpieza completada con éxito ---')
  } catch (err) {
    console.error('FALLO EN LA LIMPIEZA:', err)
  }
}

cleanup()
