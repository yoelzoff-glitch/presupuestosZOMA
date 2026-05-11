import { redirect } from 'next/navigation'
import { getServerUserContext } from '@/lib/supabase/server'
import ConfiguracionClient from './ConfiguracionClient'

export default async function ConfiguracionPage() {
  const context = await getServerUserContext()
  if (!context) redirect('/auth/login')

  return (
    <ConfiguracionClient companyId={context.idEmpresa} />
  )
}