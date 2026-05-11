const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Simple .env.local parser
const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=')
  if (key && value) {
    env[key.trim()] = value.join('=').trim()
  }
})

async function testRPC() {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  )

  console.log('Testing get_dashboard_stats RPC...')
  
  const dummyId = '00000000-0000-0000-0000-000000000000'
  
  const { data, error } = await supabase.rpc('get_dashboard_stats', {
    company_id_param: dummyId,
    days_filter: 30,
    seller_id_param: null
  })

  if (error) {
    console.error('❌ RPC Error:', error.message)
    process.exit(1)
  }

  console.log('✅ RPC Success!')
  console.log('Returned data structure:', JSON.stringify(data, null, 2))
}

testRPC()
