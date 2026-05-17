const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://ytqdzfmlbdomidnpvelg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0cWR6Zm1sYmRvbWlkbnB2ZWxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU2MDY2OCwiZXhwIjoyMDk0MTM2NjY4fQ.MynN3LB9CALs0vswgTHR1SW2CVK7C9gyAbQX3WaYbrc'
)

async function check() {
  console.log('=== DIAGNÓSTICO DE BASE DE DATOS ===')
  
  const { data: companies } = await supabase.from('companies').select('id, name')
  console.log('Empresas registradas:', companies)

  const { data: budgets } = await supabase.from('budgets').select('id, budget_number, budget_code, company_id, created_at')
  console.log('Total Presupuestos:', budgets?.length)
  console.log('Presupuestos:', budgets)

  const { data: orders } = await supabase.from('orders').select('id, order_number, company_id, created_at')
  console.log('Total Pedidos:', orders?.length)
  console.log('Pedidos:', orders)
}

check()
