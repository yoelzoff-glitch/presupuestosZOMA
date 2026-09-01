import { NextResponse } from 'next/server'
import { createServerComponentClient, createSupabaseAdminClient } from '@/lib/supabase/server'

export interface RequireCompanyUserOptions {
  allowedRoles?: string[]
}

export interface AuthenticatedCompanyUser {
  userId: string
  companyId: string
  role: string
}

export type AuthResult = 
  | { success: true; user: AuthenticatedCompanyUser }
  | { success: false; response: NextResponse }

export async function requireCompanyUser(options?: RequireCompanyUserOptions): Promise<AuthResult> {
  const allowedRoles = options?.allowedRoles || ['admin', 'super_admin']

  try {
    // 1. Obtener cliente SSR con las cookies de la petición
    const supabase = await createServerComponentClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'No autenticado. Inicie sesión para continuar.' },
          { status: 401 }
        )
      }
    }

    // 2. Obtener perfil de usuario desde Supabase con cliente admin para asegurar lectura
    const supabaseAdmin = createSupabaseAdminClient()
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.company_id) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'No se encontró la empresa asociada al usuario.' },
          { status: 403 }
        )
      }
    }

    // 3. Validar roles permitidos
    const userRole = profile.role || 'user'
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return {
        success: false,
        response: NextResponse.json(
          { error: `Acceso denegado. Rol requerido: ${allowedRoles.join(', ')}` },
          { status: 403 }
        )
      }
    }

    return {
      success: true,
      user: {
        userId: user.id,
        companyId: profile.company_id,
        role: userRole
      }
    }
  } catch (error: any) {
    console.error('Error en requireCompanyUser:', error)
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Error de autenticación del servidor.' },
        { status: 500 }
      )
    }
  }
}
