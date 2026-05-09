
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  console.log('Probando insert en budgets...')
  const { error: bError } = await supabase.from('budgets').insert({
    company_id: '00000000-0000-0000-0000-000000000000',
    seller_id: '00000000-0000-0000-0000-000000000000'
  }).select()
  
  if (bError) console.log('Error en budgets:', bError.message, bError.code)
  else console.log('Budgets OK (o al menos existe la columna seller_id)')

  console.log('\nProbando insert en orders...')
  const { error: oError } = await supabase.from('orders').insert({
    company_id: '00000000-0000-0000-0000-000000000000',
    seller_id: '00000000-0000-0000-0000-000000000000'
  }).select()

  if (oError) console.log('Error en orders:', oError.message, oError.code)
  else console.log('Orders OK (o al menos existe la columna seller_id)')
}

test()
