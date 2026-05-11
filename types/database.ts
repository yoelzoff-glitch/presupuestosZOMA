/**
 * Shared TypeScript types for the ZOMA ERP application.
 * 
 * TODO: Generate these automatically with `npx supabase gen types typescript`
 * once supabase/schema.sql is populated.
 */

// ─── Auth & Profiles ────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'vendedor' | 'customer'

export type PlanType = 'base' | 'pro' | 'pro_plus'

export type UserProfile = {
  id: string
  company_id: string
  full_name: string
  role: UserRole
  company?: Company
}

export type Company = {
  id: string
  name: string
  plan_type: PlanType
  cuit?: string | null
  address?: string | null
  phone?: string | null
  logo_url?: string | null
}

// ─── Products ───────────────────────────────────────────────────────────────

export type Product = {
  id: string
  company_id: string
  internal_code: string | null
  name: string
  category: string | null
  supplier: string | null
  cost_price: number
  active: boolean
  last_price_update?: string | null
}

// ─── Clients ────────────────────────────────────────────────────────────────

export type Client = {
  id: string
  company_id: string
  name: string
  cuit: string | null
  email: string | null
  phone: string | null
  address: string | null
}

// ─── Budgets ────────────────────────────────────────────────────────────────

export type BudgetStatus = 'draft' | 'issued' | 'approved' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export type Budget = {
  id: string
  company_id: string
  client_id: string
  budget_number: number
  total_amount: number
  status: BudgetStatus
  payment_status: PaymentStatus
  seller_id: string | null
  notes: string | null
  created_at: string
  client?: Client
}

export type BudgetItem = {
  id: string
  budget_id: string
  product_id: string | null
  product_name: string
  product_code: string | null
  category: string | null
  quantity: number
  unit_price: number
  discount_str: string | null
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'confirmed' | 'converted' | 'cancelled'
export type OrderSource = 'manual' | 'budget' | 'portal'

export type Order = {
  id: string
  company_id: string
  client_id: string
  order_number: number
  order_code: string | null
  order_date: string
  total_amount: number
  status: OrderStatus
  source: OrderSource
  seller_id: string | null
  notes: string | null
  created_at: string
  client?: Client
}

export type OrderItem = {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  product_code: string | null
  quantity: number
  unit_price: number
}

// ─── Account Movements ──────────────────────────────────────────────────────

export type AccountMovement = {
  id: string
  company_id: string
  client_id: string
  debit: number
  credit: number
  description: string
  reference_type: string | null
  reference_id: string | null
  created_at: string
  client?: Client
}

// ─── Notifications ──────────────────────────────────────────────────────────

export type Notification = {
  id: string
  company_id: string
  user_id: string | null
  title: string
  message: string
  read: boolean
  type: string | null
  reference_id: string | null
  created_at: string
}

// ─── Portal / Customer ──────────────────────────────────────────────────────

export type CustomerUser = {
  id: string
  user_id: string
  client_id: string
  company_id: string
  client?: Client
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export type DashboardStats = {
  clients: number
  products: number
  budgets: number
  balance: number
  totalBudgeted: number
  totalConverted: number
  conversionRate: number
  salesHistory: { month: string; total: number }[]
  topProducts: { name: string; quantity: number }[]
  paymentStatus: { name: string; value: number; color: string }[]
}
