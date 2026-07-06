import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticar Admin
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

    const { data: { user: adminUser } } = await supabase.auth.getUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role, company_id')
      .eq('id', adminUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Permiso denegado', 
        detail: 'La creación de cuentas espejo requiere el rol de Administrador.' 
      }, { status: 403 })
    }

    // Validar plan PRO
    const { data: company } = await supabase
      .from('companies')
      .select('plan_type')
      .eq('id', profile.company_id)
      .single()

    const planType = company?.plan_type || 'base'
    if (planType === 'base') {
      return NextResponse.json({ 
        error: 'Función no disponible', 
        detail: 'Las cuentas espejo requieren un plan PRO o superior.' 
      }, { status: 403 })
    }

    const email = adminUser.email || ''
    if (email.endsWith('@zomahub.com')) {
      return NextResponse.json({ 
        error: 'Operación no válida', 
        detail: 'Las cuentas espejo no pueden crear otras cuentas espejo.' 
      }, { status: 400 })
    }

    // Verificar si ya existe una cuenta espejo
    const { data: existingLink } = await supabaseAdmin
      .from('mirror_accounts')
      .select('*')
      .eq('primary_user_id', adminUser.id)
      .maybeSingle()

    if (existingLink) {
      return NextResponse.json({ 
        error: 'Cuenta espejo existente', 
        detail: `Ya tenés una cuenta espejo registrada: ${existingLink.mirror_email}` 
      }, { status: 400 })
    }

    // 2. Generar email espejo
    const [username] = email.split('@')
    const mirrorEmail = `${username}@zomahub.com`.toLowerCase()

    // 3. Crear usuario espejo en Auth con confirmación automática
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: mirrorEmail,
      password: crypto.randomUUID(), // Contraseña temporal, se sincronizará inmediatamente
      email_confirm: true,
      user_metadata: { 
        full_name: `${adminUser.user_metadata?.full_name || 'Admin'} (Espejo)` 
      }
    })

    if (authError || !authData.user) {
      return NextResponse.json({ 
        error: 'Error creando usuario de autenticación', 
        detail: authError?.message 
      }, { status: 400 })
    }

    // 4. Crear Perfil en users_profiles
    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .upsert({
        id: authData.user.id,
        company_id: profile.company_id,
        full_name: `${adminUser.user_metadata?.full_name || 'Admin'} (Espejo)`,
        role: 'admin'
      })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ 
        error: 'Error creando perfil de cuenta espejo', 
        detail: profileError.message 
      }, { status: 500 })
    }

    // 5. Vincular en mirror_accounts
    const { error: linkError } = await supabaseAdmin
      .from('mirror_accounts')
      .insert({
        company_id: profile.company_id,
        primary_user_id: adminUser.id,
        mirror_user_id: authData.user.id,
        mirror_email: mirrorEmail,
        is_active: true
      })

    if (linkError) {
      await supabaseAdmin.from('users_profiles').delete().eq('id', authData.user.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ 
        error: 'Error de vinculación espejo', 
        detail: linkError.message 
      }, { status: 500 })
    }

    // 6. Sincronizar contraseña inicial desde la cuenta normal
    const { error: rpcError } = await supabaseAdmin.rpc('sync_mirror_initial_password', {
      primary_uid: adminUser.id,
      mirror_uid: authData.user.id
    })

    if (rpcError) {
      console.error('Error al sincronizar la contraseña inicial del espejo:', rpcError)
      // No hacemos rollback completo porque las cuentas ya están creadas,
      // pero avisamos para que lo consideren o lancen un password reset si es necesario.
    }

    return NextResponse.json({ ok: true, mirrorEmail })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Error interno del servidor', detail: error.message }, { status: 500 })
  }
}
