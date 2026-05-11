import { redirect } from 'next/navigation'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'
import VendedoresClient from './VendedoresClient'

export default async function VendedoresPage() {
  const contexto = await getServerUserContext()
  if (!contexto) redirect('/auth/login')

  // Redirigir si no es admin, ya que esta página es de gestión global
  if (contexto.rol !== 'admin') redirect('/')

  const supabase = await createServerComponentClient()

  const [vendedoresRes, statsRes] = await Promise.all([
    supabase
      .from('users_profiles')
      .select('*')
      .eq('company_id', contexto.idEmpresa)
      .eq('role', 'vendedor')
      .order('full_name'),
    
    // Traer últimos presupuestos para stats iniciales
    supabase
      .from('budgets')
      .select('total_amount, status, seller_id, users_profiles!budgets_seller_id_fkey(full_name)')
      .eq('company_id', contexto.idEmpresa)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
  ])

  // Procesar stats iniciales
  const presupuestos = statsRes.data || []
  const estadisticasVendedores: Record<string, any> = {}
  
  presupuestos.forEach((b: any) => {
    const idVendedor = b.seller_id || 'system'
    const nombreVendedor = (b.users_profiles as any)?.full_name || 'Sistema'
    
    if (!estadisticasVendedores[idVendedor]) {
      estadisticasVendedores[idVendedor] = { nombre: nombreVendedor, ventasTotales: 0, cantidad: 0, aprobados: 0 }
    }
    
    estadisticasVendedores[idVendedor].cantidad++
    if (b.status === 'approved') {
      estadisticasVendedores[idVendedor].ventasTotales += Number(b.total_amount || 0)
      estadisticasVendedores[idVendedor].aprobados++
    }
  })

  const listaVendedores = Object.values(estadisticasVendedores)
  const mejorVendedor = listaVendedores.length > 0 ? listaVendedores.reduce((a: any, b: any) => (a.ventasTotales > b.ventasTotales ? a : b)) : { nombre: 'Sin datos', ventasTotales: 0 }
  const mejorProspector = listaVendedores.length > 0 ? listaVendedores.reduce((a: any, b: any) => (a.cantidad > b.cantidad ? a : b)) : { nombre: 'Sin datos', cantidad: 0 }
  const mejorConversion = listaVendedores.length > 0 
    ? (listaVendedores as any[])
      .map(s => ({ ...s, tasa: s.cantidad > 0 ? (s.aprobados / s.cantidad) * 100 : 0 }))
      .reduce((a, b) => (a.tasa > b.tasa ? a : b))
    : { nombre: 'Sin datos', tasa: 0 }

  const initialStats = {
    topSeller: { name: mejorVendedor.nombre, value: (mejorVendedor as any).ventasTotales },
    topProspector: { name: mejorProspector.nombre, value: (mejorProspector as any).cantidad },
    bestConversion: { name: (mejorConversion as any).nombre, value: (mejorConversion as any).tasa },
    totalBudgets: presupuestos.length,
    totalSales: presupuestos.filter(b => b.status === 'approved').reduce((acc, b) => acc + Number(b.total_amount), 0)
  }

  return (
    <VendedoresClient
      vendedoresIniciales={vendedoresRes.data || []}
      estadisticasIniciales={initialStats}
      tipoPlan={contexto.tipoPlan}
      idEmpresa={contexto.idEmpresa}
    />
  )
}
