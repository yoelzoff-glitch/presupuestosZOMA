import { Metadata } from 'next'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import BudgetPublicClient from './BudgetPublicClient'

// Función para generar metadatos dinámicos (WhatsApp Preview)
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const supabaseAdmin = createSupabaseAdminClient()

  const { data: budget } = await supabaseAdmin
    .from('budgets')
    .select('budget_number, budget_code, company_id')
    .eq('id', id)
    .single()

  if (!budget) return { title: 'Presupuesto - ERP Comercial' }

  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('name, logo_url')
    .eq('id', budget.company_id)
    .single()

  const label = budget.budget_code || `#000-${budget.budget_number}`
  const companyName = company?.name || 'nuestra empresa'
  const logoUrl = company?.logo_url

  return {
    title: `Presupuesto ${label} - ${companyName}`,
    description: `Hacé clic para ver el detalle del presupuesto de ${companyName}.`,
    openGraph: {
      title: `Presupuesto ${label} - ${companyName}`,
      description: `Hacé clic para ver el detalle del presupuesto de ${companyName}.`,
      type: 'website',
      images: logoUrl ? [{
        url: logoUrl,
        width: 1200,
        height: 630,
        alt: `Logo de ${companyName}`
      }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Presupuesto ${label} - ${companyName}`,
      description: `Hacé clic para ver el detalle del presupuesto de ${companyName}.`,
      images: logoUrl ? [logoUrl] : [],
    }
  }
}

export default function PublicBudgetPage() {
  return <BudgetPublicClient />
}
