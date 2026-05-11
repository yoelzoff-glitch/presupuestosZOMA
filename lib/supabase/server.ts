import { cookies } from 'next/headers'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Crea un cliente de Supabase de solo lectura para Server Components.
 * Utiliza la API cookies() de next/headers para la autenticación.
 * Respeta las políticas RLS basadas en la sesión del usuario actual.
 */
export async function createServerComponentClient() {
  const cookieStore = await cookies()

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
}

/**
 * Crea un cliente administrador de Supabase con privilegios service_role.
 * Usar esto ÚNICAMENTE cuando sea necesario evadir RLS (ej: creación de usuarios).
 * NUNCA exponer este cliente al navegador.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Ayudante para obtener el perfil del usuario actual y la información de la empresa.
 * Retorna null si el usuario no está autenticado.
 */
export async function getServerUserContext() {
  const supabase = await createServerComponentClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('company_id, role, full_name, company:companies(plan_type, name)')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) return null

  return {
    idUsuario: user.id,
    idEmpresa: profile.company_id,
    rol: profile.role as string,
    nombreCompleto: profile.full_name as string,
    tipoPlan: ((profile.company as any)?.plan_type || 'base') as string,
    nombreEmpresa: ((profile.company as any)?.name || '') as string,
  }
}
