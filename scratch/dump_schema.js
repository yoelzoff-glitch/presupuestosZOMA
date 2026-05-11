const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function dumpSchema() {
  // Intentamos obtener una lista de tablas y sus columnas
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT 
        table_name, 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `
  })

  if (error) {
    // Si el RPC execute_sql no existe (es común), intentamos vía REST si está habilitado
    // O simplemente fallamos si no hay acceso directo a postgres
    console.error('Error fetching schema:', error.message)
    return
  }

  console.log(JSON.stringify(data, null, 2))
}

// Nota: execute_sql no suele estar disponible por defecto por seguridad.
// Si no funciona, informaré al usuario.
dumpSchema()
