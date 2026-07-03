import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import LibroDiarioClient from './LibroDiarioClient'

export default async function LibroDiarioPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')
  if (contexto.rol !== 'admin') redirect('/')

  const supabase = await createServerComponentClient()

  // 1. Cargar todas las entradas del Libro Diario (últimas 1000)
  const { data: entries, error } = await supabase
    .from('v_ledger_entries')
    .select('*')
    .eq('company_id', contexto.idEmpresa)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) {
    console.error('Error loading ledger entries:', error)
  }

  // 2. Cargar compras pendientes para calcular Deuda Pasiva total de forma precisa
  const { data: purchasesPending } = await supabase
    .from('purchases')
    .select('total_cost, amount_paid')
    .eq('company_id', contexto.idEmpresa)
    .eq('payment_status', 'pending')

  const totalDeudaPasiva = (purchasesPending || []).reduce((acc, curr) => {
    const total = curr.total_cost || 0
    const pagado = curr.amount_paid || 0
    return acc + (total - pagado)
  }, 0)

  return (
    <LibroDiarioClient
      entriesIniciales={entries || []}
      totalDeudaPasivaInicial={totalDeudaPasiva}
      idEmpresa={contexto.idEmpresa}
    />
  )
}
