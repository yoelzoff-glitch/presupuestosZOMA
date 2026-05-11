import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import NotificacionesClient from './NotificacionesClient'

export default async function NotificacionesPage() {
  const context = await getServerUserContext()
  if (!context) redirect('/auth/login')

  if (context.rol !== 'admin') redirect('/')

  const supabase = await createServerComponentClient()

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('company_id', context.idEmpresa)
    .or(`user_id.is.null,user_id.eq.${context.idUsuario}`)
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <NotificacionesClient
      initialNotifications={data || []}
      companyId={context.idEmpresa}
      userId={context.idUsuario}
    />
  )
}