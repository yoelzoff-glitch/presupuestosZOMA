import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import TesoreriaClient from './TesoreriaClient'

export default async function TesoreriaPage() {
  const context = await getServerUserContext()
  if (!context) redirect('/auth/login')

  const supabase = await createServerComponentClient()

  // Obtener métodos de pago configurados para la empresa
  const { data: companyRes } = await supabase
    .from('companies')
    .select('payment_methods')
    .eq('id', context.idEmpresa)
    .single()

  const paymentMethods = (companyRes?.payment_methods as any[])?.map((m: any) => m.name) || [
    'Efectivo',
    'Transferencia',
    'Tarjeta',
    'Cheque',
  ]

  return (
    <TesoreriaClient
      companyId={context.idEmpresa}
      initialPaymentMethods={paymentMethods}
    />
  )
}
