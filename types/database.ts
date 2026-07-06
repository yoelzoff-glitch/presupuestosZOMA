/**
 * Tipos de TypeScript compartidos para la aplicación ZOMA ERP.
 * 
 * TODO: Generar estos automáticamente con `npx supabase gen types typescript`
 * una vez que supabase/schema.sql esté poblado en el proyecto remoto.
 */

// ─── Autenticación y Perfiles ───────────────────────────────────────────────

export type UserRole = 'admin' | 'vendedor' | 'customer'

export type PlanType = 'base' | 'pro' | 'pro_plus'

export type UserProfile = {
  id: string
  company_id: string
  full_name: string
  role: UserRole
  accepted_terms_version?: number
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

// ─── Productos ──────────────────────────────────────────────────────────────

export type Product = {
  id: string
  company_id: string
  internal_code: string | null
  name: string
  category: string | null
  supplier: string | null
  price: number
  active: boolean
  last_price_update?: string | null
}

// ─── Clientes ───────────────────────────────────────────────────────────────

export type Client = {
  id: string
  company_id: string
  name: string
  cuit: string | null
  email: string | null
  phone: string | null
  address: string | null
}

// ─── Presupuestos ──────────────────────────────────────────────────────────

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

// ─── Pedidos ────────────────────────────────────────────────────────────────

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

// ─── Movimientos de Cuenta (Cuenta Corriente) ────────────────────────────────

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

// ─── Notificaciones ─────────────────────────────────────────────────────────

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

// ─── Portal / Cliente ───────────────────────────────────────────────────────

export type CustomerUser = {
  id: string
  user_id: string
  client_id: string
  company_id: string
  client?: Client
}

// ─── Estadísticas de Dashboard ──────────────────────────────────────────────

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

// ─── Compras / Reabastecimiento ─────────────────────────────────────────────

export type Purchase = {
  id: string
  company_id: string
  product_id: string
  user_id: string | null
  product_name: string
  product_code: string | null
  supplier: string | null
  supplier_id: string | null
  quantity: number
  unit_cost: number
  total_cost: number
  previous_cost: number
  cost_variation: number
  purchase_date: string
  provider_invoice: string | null
  payment_method: string | null
  payment_status: 'paid' | 'pending'
  amount_paid: number
  notes: string | null
  created_at: string
}

// ─── Proveedores ────────────────────────────────────────────────────────────

export type Supplier = {
  id: string
  company_id: string
  name: string
  cuit: string | null
  phone: string | null
  email: string | null
  created_at: string
}

// ─── Pagos a Proveedores ─────────────────────────────────────────────────────

export type SupplierPayment = {
  id: string
  company_id: string
  supplier_id: string
  purchase_id: string | null
  amount: number
  payment_date: string
  payment_method: string | null
  description: string | null
  user_id: string | null
  created_at: string
  supplier?: Supplier
}

// ─── Libro Diario ────────────────────────────────────────────────────────────

export type LedgerEntry = {
  id: string
  company_id: string
  entry_date: string
  entry_type: 'ingreso' | 'egreso'
  concept: string
  amount: number
  payment_method: string | null
  created_at: string
  source_table: string
  source_id: string
}

// ─── Balances por Proveedor ──────────────────────────────────────────────────

export type SupplierBalance = {
  supplier: string
  supplier_id: string
  total_purchased: number
  total_paid: number
  balance_due: number
  purchase_count: number
}

// ─── Tesorería (Vistas SQL) ─────────────────────────────────────────────────

export type ClientBalance = {
  client_id: string
  company_id: string
  client_name: string
  cuit: string | null
  total_debit: number
  total_credit: number
  balance_due: number
}

export type TreasurySummary = {
  company_id: string
  total_cash_in: number
  total_cash_out: number
  net_cash_flow: number
  total_client_debt: number
  total_supplier_debt: number
  net_balance: number
}

// ─── Cuentas Espejo ─────────────────────────────────────────────────────────

export type RecordType = 'blanco' | 'x'

export type MirrorAccount = {
  id: string
  company_id: string
  primary_user_id: string
  mirror_user_id: string
  mirror_email: string
  is_active: boolean
  created_at: string
}
