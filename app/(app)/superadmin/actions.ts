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
    // 1. Crear el usuario en Supabase Auth usando admin privileges
    // Generamos una contraseña temporal que el usuario cambiará
    const tempPassword = Math.random().toString(36).slice(-12)
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: tempPassword,
      email_confirm: true // Confirmamos el mail de una vez
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new Error('Ese email ya está registrado en el sistema.')
      }
      throw new Error(authError.message)
    }

    // 2. Crear la Empresa
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({ name })
      .select('id')
      .single()

    if (companyError) {
      // Cleanup auth user if company creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      throw new Error('No se pudo crear la empresa: ' + companyError.message)
    }

    // 3. Crear el Perfil
    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .insert({
        id: authUser.user.id,
        company_id: company.id,
        full_name: adminEmail.split('@')[0],
        role: 'admin'
      })

    if (profileError) {
      throw new Error('Se creó el usuario y la empresa, pero falló el perfil: ' + profileError.message)
    }

    // 4. Enviar mail de recuperación para que el usuario elija su contraseña
    await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: adminEmail,
    })

    revalidatePath('/superadmin')
    return { success: true }
  } catch (err: any) {
    console.error('Error en onboarding:', err)
    throw err
  }
}
