import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import FacturasClient from './FacturasClient'

export default async function FacturasPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')

  const supabase = await createServerComponentClient()

  // Obtener facturas de los últimos 30 días
  const limiteFecha = new Date()
  limiteFecha.setDate(limiteFecha.getDate() - 30)

  const { data: facturas, error } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients ( name, cuit ),
      budget:budgets ( budget_code, budget_number )
    `)
    .eq('company_id', contexto.idEmpresa)
    .gte('created_at', limiteFecha.toISOString())
    .order('created_at', { ascending: false })

  if (error) console.error('Error cargando facturas:', error)

  return (
    <FacturasClient 
      facturasIniciales={facturas || []} 
      idEmpresa={contexto.idEmpresa}
    />
  )
}
