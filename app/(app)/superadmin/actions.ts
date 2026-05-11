'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getCompanies() {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function updateCompanyPlan(companyId: string, planType: 'base' | 'pro') {
  const { error } = await supabaseAdmin
    .from('companies')
    .update({ plan_type: planType })
    .eq('id', companyId)

  if (error) throw new Error(error.message)
  revalidatePath('/superadmin')
}

export async function createNewCompany(name: string, adminEmail: string) {
  try {
    console.log('Iniciando creación de empresa para:', adminEmail)
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'Error de configuración: Falta la SERVICE_ROLE_KEY en el servidor.' }
    }

    // 1. Crear el usuario en Supabase Auth
    const tempPassword = Math.random().toString(36).slice(-12)
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    })

    if (authError) {
      console.error('Error Auth:', authError)
      return { error: `Error de Autenticación: ${authError.message}` }
    }

    // 2. Crear la Empresa
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({ name })
      .select('id')
      .single()

    if (companyError) {
      console.error('Error Company:', companyError)
      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return { error: `Error de Base de Datos (Empresa): ${companyError.message}` }
    }

    // 3. Crear el Perfil
    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .insert({
        id: authUser.user.id,
        company_id: company.id,
        full_name: name,
        role: 'admin'
      })

    if (profileError) {
      console.error('Error Profile:', profileError)
      return { error: `Error de Base de Datos (Perfil): ${profileError.message}` }
    }

    // 4. Generar link de recuperación (opcional, si falla no bloqueamos todo)
    try {
      await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: adminEmail,
      })
    } catch (e) {
      console.warn('No se pudo enviar el mail de bienvenida, pero el usuario fue creado.')
    }

    revalidatePath('/superadmin')
    return { success: true }
  } catch (err: any) {
    console.error('Error crítico en onboarding:', err)
    return { error: `Error crítico inesperado: ${err.message || 'Desconocido'}` }
  }
}
