import { redirect } from 'next/navigation'

export default function ComprasPage() {
  redirect('/tesoreria?tab=calculadora_compras')
}
