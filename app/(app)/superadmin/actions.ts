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
  // Aquí usamos la lógica similar a la de register-company pero simplificada para el superadmin
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/register-company`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_name: name,
        email: adminEmail,
      }),
    }
  )

  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Error al crear empresa')
  
  revalidatePath('/superadmin')
  return data
}
