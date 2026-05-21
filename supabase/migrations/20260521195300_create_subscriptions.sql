-- Crear tabla de Abonos Mensuales
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies on delete cascade not null,
  client_id uuid references public.clients on delete cascade not null,
  budget_id uuid references public.budgets on delete set null, -- Referencia al presupuesto original (opcional)
  name text not null, -- Título descriptivo general del abono (ej: "Abono Mensual de Marketing")
  items jsonb not null default '[]'::jsonb, -- Líneas de detalle del abono: [{product_name, quantity, unit_price}]
  total_amount numeric(15,2) not null default 0, -- Total mensual facturable
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  last_billed_month text, -- Formato 'YYYY-MM' (ej: '2026-05') para rastrear el último mes facturado
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Crear política de aislamiento por Empresa
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.subscriptions;
CREATE POLICY "Aislamiento por Empresa" ON public.subscriptions 
FOR ALL USING (is_member_of(company_id));
