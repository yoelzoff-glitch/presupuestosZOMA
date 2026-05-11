import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verify() {
  const { count: c } = await supabaseAdmin.from('companies').select('*', { count: 'exact', head: true })
  const { count: p } = await supabaseAdmin.from('products').select('*', { count: 'exact', head: true })
  const { count: b } = await supabaseAdmin.from('budgets').select('*', { count: 'exact', head: true })
  const { count: u } = await supabaseAdmin.from('users_profiles').select('*', { count: 'exact', head: true })
  
  const report = `
--- REPORTE DE LIMPIEZA ---
Empresas: ${c} (Debería ser 1)
Productos: ${p} (Debería ser 0)
Presupuestos: ${b} (Debería ser 0)
Perfiles: ${u} (Debería ser 1)
--------------------------
`
  fs.writeFileSync('cleanup_report.txt', report)
  console.log(report)
}

verify()
