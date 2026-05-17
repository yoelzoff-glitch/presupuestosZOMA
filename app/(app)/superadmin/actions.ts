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

export async function updateCompanyPlan(companyId: string, planType: 'base' | 'pro' | 'ultra') {
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
      .insert({ 
        name: name,
        plan_type: 'base' // Aseguramos el plan inicial
      })
      .select()
      .single()

    if (companyError) {
      console.error('Error detallado Company:', companyError)
      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return { error: `Error DB Empresa: ${companyError.message} - Código: ${companyError.code}` }
    }

    // 3. Crear/Actualizar el Perfil (usamos upsert por seguridad)
    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .upsert({
        id: authUser.user.id,
        company_id: company.id,
        full_name: 'Administrador', // Valor genérico seguro
        role: 'admin'
      })

    if (profileError) {
      console.error('Error detallado Profile:', profileError)
      return { error: `Error DB Perfil: ${profileError.message} - Código: ${profileError.code}` }
    }

    // 4. Generar link de recuperación
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: adminEmail,
    })

    if (linkError) {
      console.warn('No se pudo enviar mail, pero el usuario está creado:', linkError.message)
    }

    revalidatePath('/superadmin')
    return { success: true }
  } catch (err: any) {
    console.error('Error crítico en onboarding:', err)
    return { error: `Error crítico inesperado: ${err.message || 'Desconocido'}` }
  }
}
