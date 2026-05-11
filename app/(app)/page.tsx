import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const days = (searchParams.days as string) || '30'
  const daysInt = days === 'all' ? 0 : parseInt(days)

  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return null

  // Intentamos obtener company_id de metadata, con fallback a users_profiles si aún no se ha sincronizado
  let companyId = userData.user.app_metadata.company_id
  
  if (!companyId) {
    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()
    companyId = profile?.company_id
  }

  if (!companyId) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-amber-600">Configuración incompleta</h2>
        <p className="text-slate-500">No se encontró una empresa asociada a tu perfil.</p>
      </div>
    )
  }

  // Usamos RPC para obtener todas las estadísticas en una sola consulta SQL
  const { data: stats, error } = await supabase.rpc('get_dashboard_stats', {
    company_id_param: companyId,
    days_filter: daysInt
  })

  if (error) {
    console.error('Error fetching dashboard stats:', error)
    // Fallback stats en caso de error
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-600">Error al cargar el dashboard</h2>
        <p className="text-slate-500">Por favor, verifica que la función RPC get_dashboard_stats esté instalada en Supabase.</p>
      </div>
    )
  }

  return <DashboardClient stats={stats} />
}
