import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import VendedorDashboardClient from './VendedorDashboardClient'

/**
 * Dashboard del Vendedor (RSC).
 * Utiliza la función RPC get_dashboard_stats para obtener todos los datos en una sola llamada optimizada.
 */
export default async function VendedorDashboardPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')

  const supabase = await createServerComponentClient()

  // Llamada optimizada via RPC (una sola conexión a la BD)
  const { data: statsData, error } = await supabase.rpc('get_dashboard_stats', {
    company_id_param: contexto.idEmpresa,
    days_filter: 30,
    seller_id_param: contexto.rol === 'admin' ? null : contexto.idUsuario
  })

  if (error) {
    console.error('Error cargando stats del dashboard:', error)
  }

  // Normalizar los datos para el componente cliente
  const estadisticas = {
    clientes: statsData?.clients || 0,
    presupuestos: statsData?.budgets || 0,
    pedidos: statsData?.orders || 0,
  }

  return (
    <VendedorDashboardClient 
      estadisticasIniciales={estadisticas} 
      rol={contexto.rol} 
      idUsuario={contexto.idUsuario} 
      idEmpresa={contexto.idEmpresa}
    />
  )
}
