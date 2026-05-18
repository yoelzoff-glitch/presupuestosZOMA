import { createServerComponentClient } from '@/lib/supabase/server'
import DashboardClient from '../DashboardClient'
import { Settings, Package } from 'lucide-react'

export default async function DashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const days = (searchParams.days as string) || '30'
  const daysInt = days === 'all' ? 0 : parseInt(days)

  const supabase = await createServerComponentClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return null

  // Intentamos obtener company_id de metadata, con fallback a users_profiles si aún no se ha sincronizado
  let companyId = userData.user.app_metadata?.company_id
  const isSuperAdmin = userData.user.email?.toLowerCase() === 'yoel.zoff@gmail.com'
  
  if (!companyId) {
    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()
    companyId = profile?.company_id
  }

  // Si es Super Admin y no tiene empresa, le permitimos ver el dashboard vacío o con info global
  if (!companyId && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-[2rem] border border-slate-200">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
          <Settings size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Configuración incompleta</h2>
        <p className="text-slate-500 max-w-xs mx-auto text-sm font-medium">No se encontró una empresa asociada a tu perfil. Contactá a soporte para vincular tu cuenta.</p>
      </div>
    )
  }

  // Usamos RPC para obtener todas las estadísticas en una sola consulta SQL
  // Si no hay companyId (Super Admin), pasamos null y la función debería manejarlo o devolver vacío
  const { data: stats, error } = await supabase.rpc('get_dashboard_stats', {
    company_id_param: companyId || '00000000-0000-0000-0000-000000000000', // UUID nulo para no romper el RPC
    days_filter: daysInt
  })

  if (error && !isSuperAdmin) {
    console.error('Error fetching dashboard stats:', error)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-[2rem] border border-slate-200">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
          <Package size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Error al cargar estadísticas</h2>
        <p className="text-slate-500 max-w-xs mx-auto text-sm font-medium">Hubo un problema al conectar con la base de datos.</p>
      </div>
    )
  }

  // Calculamos la conversión de presupuestos (Enviados vs Convertidos a Pedidos) de forma directa
  let budgetStatusStats: any[] = []
  if (companyId) {
    let query = supabase
      .from('budgets')
      .select('status, afip_cae')
      .eq('company_id', companyId)
      
    if (daysInt > 0) {
      const limitDate = new Date()
      limitDate.setDate(limitDate.getDate() - daysInt)
      query = query.gte('created_at', limitDate.toISOString())
    }
    
    const { data: budgetsData } = await query
    
    const counts = { approved: 0, issued: 0, draft: 0, cancelled: 0 }
    if (budgetsData) {
      budgetsData.forEach((b: any) => {
        const s = b.status
        const hasCAE = !!b.afip_cae
        
        if (s === 'cancelled') {
          counts.cancelled++
        } else if (hasCAE || s === 'approved') {
          counts.approved++ // Agrupar tanto aprobados como facturados bajo "Convertidos"
        } else if (s === 'issued') {
          counts.issued++ // Enviados reales sin facturar
        } else if (s === 'draft') {
          counts.draft++
        }
      })
    }
    
    budgetStatusStats = [
      { name: 'Convertidos', value: counts.approved, color: '#10b981' },
      { name: 'Enviados', value: counts.issued, color: '#3b82f6' },
      { name: 'Borradores', value: counts.draft, color: '#94a3b8' },
      { name: 'Cancelados', value: counts.cancelled, color: '#ef4444' }
    ].filter(item => item.value > 0)
  }

  const finalStats = {
    ...(stats || {}),
    budgetStatus: budgetStatusStats
  }

  return <DashboardClient stats={finalStats} />
}
