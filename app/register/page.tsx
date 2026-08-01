import type { Metadata } from 'next'
import { getBillingPlan } from '@/lib/billing/config'
import RegisterTrialForm from './RegisterTrialForm'

export const metadata: Metadata = {
  title: 'Crear empresa | ZOMA ERP',
  description: 'Crea tu empresa y comienza una prueba gratuita de ZOMA ERP.',
}

export default function RegisterPage() {
  const base = getBillingPlan('base')
  const pro = getBillingPlan('pro')

  return (
    <RegisterTrialForm
      plans={{
        base: { name: base.name, amount: base.amount },
        pro: { name: pro.name, amount: pro.amount },
      }}
    />
  )
}
