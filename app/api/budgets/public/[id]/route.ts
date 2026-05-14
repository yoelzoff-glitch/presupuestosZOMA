import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del presupuesto' }, { status: 400 })
    }

    // 1. Fetch Budget and Client
    const { data: budget, error: budgetError } = await supabaseAdmin
      .from('budgets')
      .select(`
        id,
        company_id,
        budget_number,
        budget_code,
        budget_date,
        total_amount,
        notes,
        clients (
          name,
          cuit,
          address
        )
      `)
      .eq('id', id)
      .single()

    if (budgetError || !budget) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    // 2. Fetch Company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('name, cuit, address, phone, email, logo_url, default_notes')
      .eq('id', budget.company_id)
      .single()

    // 3. Fetch Items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('budget_items')
      .select('id, product_code, product_name, quantity, unit_price, discount_str')
      .eq('budget_id', id)
      .order('created_at', { ascending: true })

    const normalizedBudget = {
      ...budget,
      clients: Array.isArray(budget.clients) ? budget.clients[0] : budget.clients,
    }

    return NextResponse.json({
      budget: normalizedBudget,
      company: company || null,
      items: items || []
    })
  } catch (error) {
    console.error('Error fetching public budget:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
