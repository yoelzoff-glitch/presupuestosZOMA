-- Esquema de Base de Datos ZOMA ERP
-- Última actualización: 2026-05-11
-- Este archivo sirve como fuente única de verdad para la infraestructura de la base de datos.

-- Habilitar extensiones necesarias
create extension if not exists "uuid-ossp";

-- ─── EMPRESAS (COMPANIES) ──────────────────────────────────────────────────
-- Representa a un inquilino (tenant/empresa) en el sistema multi-inquilino.
create table public.companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  plan_type text not null default 'base' check (plan_type in ('base', 'pro', 'pro_plus')),
  cuit text,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  default_notes text,
  payment_methods jsonb default '[]'::jsonb, -- Arreglo de {nombre, tipo, config}
  created_at timestamp with time zone default now()
);

-- ─── PERFILES DE USUARIO (USERS PROFILES) ──────────────────────────────────
-- Datos extendidos de usuario vinculados a auth.users.
create table public.users_profiles (
  id uuid references auth.users on delete cascade primary key,
  company_id uuid references public.companies on delete cascade not null,
  full_name text not null,
  role text not null default 'vendedor' check (role in ('admin', 'vendedor', 'customer')),
  accepted_terms_version integer default 1,
  created_at timestamp with time zone default now()
);

-- ─── PRODUCTOS (PRODUCTS) ──────────────────────────────────────────────────
-- Catálogo de productos por empresa.
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies on delete cascade not null,
  internal_code text,
  name text not null,
  category text,
  supplier text,
  price numeric(15,2) not null default 0,
  active boolean default true,
  last_price_update timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- ─── CLIENTS (CLIENTS) ────────────────────────────────────────────────────
-- Clientes gestionados por la empresa o vendedores específicos.
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies on delete cascade not null,
  seller_id uuid references auth.users on delete set null,
  name text not null,
  cuit text,
  email text,
  phone text,
  address text,
  active boolean default true,
  created_at timestamp with time zone default now()
);

-- ─── USUARIOS CLIENTE (CUSTOMER USERS) ─────────────────────────────────────
-- Usuarios finales (clientes) que acceden al portal para ver precios y comprar.
create table public.customer_users (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies on delete cascade not null,
  client_id uuid references public.clients on delete set null,
  auth_user_id uuid references auth.users on delete cascade not null,
  name text not null,
  email text not null,
  phone text,
  active boolean default true,
  created_at timestamp with time zone default now()
);

-- ─── PEDIDOS DE PORTAL (CUSTOMER ORDERS) ───────────────────────────────────
-- Pedidos iniciados por clientes desde el portal.
create table public.customer_orders (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies on delete cascade not null,
  customer_user_id uuid references public.customer_users on delete cascade not null,
  total_amount numeric(15,2) default 0,
  status text default 'pending',
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ─── ITEMS DE PEDIDO PORTAL (CUSTOMER ORDER ITEMS) ────────────────────────
create table public.customer_order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.customer_orders on delete cascade not null,
  product_id uuid references public.products on delete cascade not null,
  product_name text not null,
  internal_code text,
  quantity numeric(15,3) not null,
  unit_price numeric(15,2) not null,
  total_price numeric(15,2) generated always as (quantity * unit_price) stored,
  created_at timestamp with time zone default now()
);

-- ─── PRESUPUESTOS (BUDGETS) ────────────────────────────────────────────────
-- Cotizaciones generadas por vendedores o administradores.
create table public.budgets (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies on delete cascade not null,
  client_id uuid references public.clients on delete cascade not null,
  seller_id uuid references auth.users on delete set null,
  budget_number integer not null,
  budget_code text,
  budget_date date default current_date,
  total_amount numeric(15,2) default 0,
  status text default 'issued' check (status in ('draft', 'issued', 'approved', 'cancelled')),
  payment_status text default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ─── ITEMS DE PRESUPUESTO (BUDGET ITEMS) ───────────────────────────────────
-- Líneas de detalle dentro de un presupuesto.
create table public.budget_items (
  id uuid default uuid_generate_v4() primary key,
  budget_id uuid references public.budgets on delete cascade not null,
  company_id uuid references public.companies on delete cascade not null,
  product_id uuid references public.products on delete set null,
  product_name text not null,
  product_code text,
  category text,
  quantity numeric(15,3) not null,
  unit_price numeric(15,2) not null,
  total numeric(15,2) generated always as (quantity * unit_price) stored,
  discount_str text,
  created_at timestamp with time zone default now()
);

-- ─── PEDIDOS (ORDERS) ──────────────────────────────────────────────────────
-- Órdenes de venta finalizadas.
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies on delete cascade not null,
  client_id uuid references public.clients on delete cascade not null,
  budget_id uuid references public.budgets on delete set null,
  seller_id uuid references auth.users on delete set null,
  order_number integer not null,
  order_code text,
  order_date timestamp with time zone default now(),
  total_amount numeric(15,2) default 0,
  status text default 'pending' check (status in ('pending', 'confirmed', 'converted', 'cancelled')),
  source text default 'manual',
  notes text,
  created_at timestamp with time zone default now()
);

-- ─── ITEMS DE PEDIDO (ORDER ITEMS) ─────────────────────────────────────────
-- Líneas de detalle dentro de un pedido.
create table public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders on delete cascade not null,
  company_id uuid references public.companies on delete cascade not null,
  product_id uuid references public.products on delete set null,
  product_name text not null,
  product_code text,
  category text,
  quantity numeric(15,3) not null,
  unit_price numeric(15,2) not null,
  discount_str text,
  created_at timestamp with time zone default now()
);

-- ─── MOVIMIENTOS DE CUENTA (ACCOUNT MOVEMENTS) ─────────────────────────────
-- Libro mayor para deudas de clientes (Cuenta Corriente).
create table public.account_movements (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies on delete cascade not null,
  client_id uuid references public.clients on delete cascade not null,
  debit numeric(15,2) default 0,
  credit numeric(15,2) default 0,
  description text not null,
  reference_type text, -- 'budget', 'order', 'manual', 'payment'
  reference_id uuid,
  created_at timestamp with time zone default now()
);

-- ─── NOTIFICACIONES (NOTIFICATIONS) ────────────────────────────────────────
-- Notificaciones del sistema para usuarios.
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies on delete cascade not null,
  user_id uuid references auth.users on delete cascade,
  title text not null,
  message text not null,
  read boolean default false,
  type text,
  link text,
  reference_id uuid,
  created_at timestamp with time zone default now()
);

-- ─── POLÍTICAS RLS ─────────────────────────────────────────────────────────

-- Habilitar RLS en todas las tablas
alter table public.companies enable row level security;
alter table public.users_profiles enable row level security;
alter table public.products enable row level security;
alter table public.clients enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.account_movements enable row level security;
alter table public.notifications enable row level security;
alter table public.customer_users enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;

-- FUNCIÓN AUXILIAR PARA RLS
-- Comprueba si un usuario pertenece a una empresa específica.
create or replace function public.is_member_of(company_uuid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.users_profiles
    where id = auth.uid() and company_id = company_uuid
  ) or exists (
    select 1 from public.customer_users
    where auth_user_id = auth.uid() and company_id = company_uuid
  );
end;
$$ language plpgsql security definer;

-- Los usuarios solo pueden acceder a datos pertenecientes a su empresa.
create policy "Aislamiento por Empresa" on public.products for all using (is_member_of(company_id));
create policy "Aislamiento por Empresa" on public.clients for all using (is_member_of(company_id));
create policy "Aislamiento por Empresa" on public.budgets for all using (is_member_of(company_id));
create policy "Aislamiento por Empresa" on public.budget_items for all using (is_member_of(company_id));
create policy "Aislamiento por Empresa" on public.orders for all using (is_member_of(company_id));
create policy "Aislamiento por Empresa" on public.order_items for all using (is_member_of(company_id));
create policy "Aislamiento por Empresa" on public.account_movements for all using (is_member_of(company_id));
create policy "Aislamiento por Empresa" on public.notifications for all using (is_member_of(company_id));
create policy "Aislamiento por Empresa" on public.customer_users for all using (is_member_of(company_id));
create policy "Aislamiento por Empresa" on public.customer_orders for all using (is_member_of(company_id));

-- Items de pedidos portal: acceso si el pedido es de la empresa
create policy "Aislamiento por Empresa" on public.customer_order_items for all 
using (
  exists (
    select 1 from public.customer_orders
    where id = public.customer_order_items.order_id and is_member_of(company_id)
  )
);

-- Los usuarios solo pueden ver su propio perfil
create policy "Los usuarios pueden ver su propio perfil" 
on public.users_profiles for select 
using (auth.uid() = id);

-- Los administradores pueden ver todos los perfiles en su empresa
create policy "Los administradores pueden ver perfiles de la empresa" 
on public.users_profiles for select 
using (
  exists (
    select 1 from public.users_profiles
    where id = auth.uid() and company_id = public.users_profiles.company_id and role = 'admin'
  )
);

-- ─── FUNCIONES Y PROCEDIMIENTOS (FUNCTIONS) ───────────────────────────────

-- 1. Función RPC para obtener estadísticas del dashboard de forma eficiente
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(company_id_param UUID, days_filter INT DEFAULT 30, seller_id_param UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    date_limit TIMESTAMP;
    result JSON;
BEGIN
    -- Determinar el límite de fecha basado en el filtro
    IF days_filter IS NULL OR days_filter = 0 THEN
        date_limit := '1900-01-01'::TIMESTAMP;
    ELSE
        date_limit := NOW() - (days_filter || ' days')::INTERVAL;
    END IF;

    WITH stats AS (
        SELECT
            (SELECT COUNT(*) FROM clients WHERE company_id = company_id_param AND (seller_id_param IS NULL OR seller_id = seller_id_param)) as clients_count,
            (SELECT COUNT(*) FROM products WHERE company_id = company_id_param) as products_count,
            (SELECT COUNT(*) FROM budgets WHERE company_id = company_id_param AND created_at >= date_limit AND (seller_id_param IS NULL OR seller_id = seller_id_param)) as budgets_count,
            (SELECT COUNT(*) FROM orders WHERE company_id = company_id_param AND created_at >= date_limit AND (seller_id_param IS NULL OR seller_id = seller_id_param)) as orders_count,
            (SELECT COALESCE(SUM(debit - credit), 0) FROM account_movements WHERE company_id = company_id_param AND created_at >= date_limit AND (seller_id_param IS NULL OR client_id IN (SELECT id FROM clients WHERE seller_id = seller_id_param))) as total_balance,
            (SELECT COALESCE(SUM(total_amount), 0) FROM budgets WHERE company_id = company_id_param AND status != 'cancelled' AND created_at >= date_limit AND (seller_id_param IS NULL OR seller_id = seller_id_param)) as total_budgeted,
            (SELECT COALESCE(SUM(total_amount), 0) FROM budgets WHERE company_id = company_id_param AND status = 'approved' AND created_at >= date_limit AND (seller_id_param IS NULL OR seller_id = seller_id_param)) as total_converted
    ),
    history AS (
        SELECT 
            TO_CHAR(created_at, 'Mon YY') as month_key,
            SUM(total_amount) as total
        FROM budgets 
        WHERE company_id = company_id_param 
          AND status != 'cancelled' 
          AND created_at >= date_limit
          AND (seller_id_param IS NULL OR seller_id = seller_id_param)
        GROUP BY 1, TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY TO_CHAR(created_at, 'YYYY-MM') DESC
        LIMIT 6
    ),
    top_products AS (
        SELECT 
            bi.product_name as name,
            SUM(bi.quantity) as quantity
        FROM budget_items bi
        JOIN budgets b ON bi.budget_id = b.id
        WHERE b.company_id = company_id_param 
          AND b.created_at >= date_limit
          AND (seller_id_param IS NULL OR b.seller_id = seller_id_param)
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 5
    ),
    p_status AS (
        SELECT 
            COALESCE(payment_status, 'unpaid') as status,
            COUNT(*) as count
        FROM budgets
        WHERE company_id = company_id_param 
          AND created_at >= date_limit
          AND (seller_id_param IS NULL OR seller_id = seller_id_param)
        GROUP BY 1
    )
    SELECT json_build_object(
        'clients', (SELECT clients_count FROM stats),
        'products', (SELECT products_count FROM stats),
        'budgets', (SELECT budgets_count FROM stats),
        'orders', (SELECT orders_count FROM stats),
        'balance', (SELECT total_balance FROM stats),
        'totalBudgeted', (SELECT total_budgeted FROM stats),
        'totalConverted', (SELECT total_converted FROM stats),
        'conversionRate', CASE WHEN (SELECT total_budgeted FROM stats) > 0 THEN ((SELECT total_converted FROM stats)::FLOAT / (SELECT total_budgeted FROM stats)::FLOAT) * 100 ELSE 0 END,
        'salesHistory', COALESCE((SELECT json_agg(json_build_object('month', month_key, 'total', total)) FROM (SELECT * FROM history ORDER BY month_key ASC) h), '[]'::json),
        'topProducts', COALESCE((SELECT json_agg(json_build_object('name', name, 'quantity', quantity)) FROM top_products), '[]'::json),
        'paymentStatus', COALESCE((SELECT json_agg(json_build_object(
            'name', CASE 
                WHEN status = 'paid' THEN 'Pagados' 
                WHEN status = 'partial' THEN 'Parciales' 
                ELSE 'Pendientes' 
            END,
            'value', count,
            'color', CASE 
                WHEN status = 'paid' THEN '#10b981' 
                WHEN status = 'partial' THEN '#f59e0b' 
                ELSE '#ef4444' 
            END
        )) FROM p_status), '[]'::json)
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Sincronización de Rol a App Metadata (para optimizar middleware)
CREATE OR REPLACE FUNCTION public.handle_sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', NEW.role, 
      'accepted_terms_version', NEW.accepted_terms_version,
      'company_id', NEW.company_id
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizaciones en users_profiles
DROP TRIGGER IF EXISTS on_user_profile_updated ON public.users_profiles;
CREATE TRIGGER on_user_profile_updated
  AFTER INSERT OR UPDATE ON public.users_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_sync_user_role();
