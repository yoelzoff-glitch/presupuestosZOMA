import { Metadata } from 'next'
import { supabase } from '@/lib/supabase/client'
import BudgetPublicClient from './BudgetPublicClient'

// Función para generar metadatos dinámicos (WhatsApp Preview)
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params

  const { data: budget } = await supabase
    .from('budgets')
    .select('budget_number, budget_code, company_id')
    .eq('id', id)
    .single()

  if (!budget) return { title: 'Presupuesto - ERP Comercial' }

  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', budget.company_id)
    .single()

  const label = budget.budget_code || `#000-${budget.budget_number}`
  const companyName = company?.name || 'nuestra empresa'

  return {
    title: `Presupuesto ${label} - ${companyName}`,
    description: `Hacé clic para ver el detalle del presupuesto de ${companyName}.`,
    openGraph: {
      title: `Presupuesto ${label} - ${companyName}`,
      description: `Hacé clic para ver el detalle del presupuesto de ${companyName}.`,
      type: 'website',
    },
  }
}

export default function PublicBudgetPage() {
  return <BudgetPublicClient />
}
