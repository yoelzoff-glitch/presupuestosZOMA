-- Migration: Cuentas Espejo en Paralelo
-- Create mirror_accounts, add record_type to transactional tables, configure RLS, and add password sync.

-- 1. Crear tabla mirror_accounts
CREATE TABLE IF NOT EXISTS public.mirror_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  primary_user_id uuid NOT NULL,     -- Cuenta normal (ej: agus@gmail.com)
  mirror_user_id uuid NOT NULL,      -- Cuenta espejo (ej: agus@zomahub.com)
  mirror_email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mirror_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT mirror_accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  CONSTRAINT mirror_accounts_primary_user_unique UNIQUE (primary_user_id),
  CONSTRAINT mirror_accounts_mirror_user_unique UNIQUE (mirror_user_id)
);

CREATE INDEX IF NOT EXISTS idx_mirror_accounts_company ON public.mirror_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_mirror_accounts_mirror_user ON public.mirror_accounts(mirror_user_id);

ALTER TABLE public.mirror_accounts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para mirror_accounts
CREATE POLICY "Aislamiento por Empresa en mirror_accounts" ON public.mirror_accounts
  FOR ALL USING (company_id IN (SELECT company_id FROM public.users_profiles WHERE id = auth.uid()));

-- 2. Agregar columna record_type a las tablas transaccionales
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'blanco'
  CHECK (record_type IN ('blanco', 'x'));

ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'blanco'
  CHECK (record_type IN ('blanco', 'x'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'blanco'
  CHECK (record_type IN ('blanco', 'x'));

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'blanco'
  CHECK (record_type IN ('blanco', 'x'));

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'blanco'
  CHECK (record_type IN ('blanco', 'x'));

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'blanco'
  CHECK (record_type IN ('blanco', 'x'));

ALTER TABLE public.account_movements
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'blanco'
  CHECK (record_type IN ('blanco', 'x'));

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'blanco'
  CHECK (record_type IN ('blanco', 'x'));

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'blanco'
  CHECK (record_type IN ('blanco', 'x'));

ALTER TABLE public.supplier_payments
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'blanco'
  CHECK (record_type IN ('blanco', 'x'));

-- 3. Función helper is_mirror_user()
CREATE OR REPLACE FUNCTION public.is_mirror_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.mirror_accounts
    WHERE mirror_user_id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Reemplazar políticas RLS en tablas transaccionales para soportar segregación de cuentas espejo

-- budgets
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.budgets;
CREATE POLICY "Aislamiento por Empresa" ON public.budgets FOR ALL
USING (
  is_member_of(company_id)
  AND (record_type = 'blanco' OR NOT is_mirror_user())
);

-- budget_items
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.budget_items;
CREATE POLICY "Aislamiento por Empresa" ON public.budget_items FOR ALL
USING (
  is_member_of(company_id)
  AND (record_type = 'blanco' OR NOT is_mirror_user())
);

-- orders
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.orders;
CREATE POLICY "Aislamiento por Empresa" ON public.orders FOR ALL
USING (
  is_member_of(company_id)
  AND (record_type = 'blanco' OR NOT is_mirror_user())
);

-- order_items
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.order_items;
CREATE POLICY "Aislamiento por Empresa" ON public.order_items FOR ALL
USING (
  is_member_of(company_id)
  AND (record_type = 'blanco' OR NOT is_mirror_user())
);

-- invoices
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.invoices;
CREATE POLICY "Aislamiento por Empresa" ON public.invoices FOR ALL
USING (
  is_member_of(company_id)
  AND (record_type = 'blanco' OR NOT is_mirror_user())
);

-- invoice_items
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.invoice_items;
CREATE POLICY "Aislamiento por Empresa" ON public.invoice_items FOR ALL
USING (
  is_member_of(
    (SELECT company_id FROM public.invoices WHERE id = public.invoice_items.invoice_id)
  )
  AND (record_type = 'blanco' OR NOT is_mirror_user())
);

-- account_movements
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.account_movements;
CREATE POLICY "Aislamiento por Empresa" ON public.account_movements FOR ALL
USING (
  is_member_of(company_id)
  AND (record_type = 'blanco' OR NOT is_mirror_user())
);

-- payments
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.payments;
CREATE POLICY "Aislamiento por Empresa" ON public.payments FOR ALL
USING (
  is_member_of(company_id)
  AND (record_type = 'blanco' OR NOT is_mirror_user())
);

-- purchases
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.purchases;
CREATE POLICY "Aislamiento por Empresa" ON public.purchases FOR ALL
USING (
  is_member_of(company_id)
  AND (record_type = 'blanco' OR NOT is_mirror_user())
);

-- supplier_payments
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.supplier_payments;
CREATE POLICY "Aislamiento por Empresa" ON public.supplier_payments FOR ALL
USING (
  is_member_of(company_id)
  AND (record_type = 'blanco' OR NOT is_mirror_user())
);


-- 5. Sincronización de Contraseña
CREATE OR REPLACE FUNCTION public.sync_mirror_password()
RETURNS trigger AS $$
DECLARE
  v_mirror_id uuid;
BEGIN
  IF OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password THEN
    -- Caso 1: El primario cambia
    SELECT mirror_user_id INTO v_mirror_id
    FROM public.mirror_accounts
    WHERE primary_user_id = NEW.id AND is_active = true;

    IF v_mirror_id IS NOT NULL THEN
      UPDATE auth.users SET encrypted_password = NEW.encrypted_password
      WHERE id = v_mirror_id;
    END IF;

    -- Caso 2: El espejo cambia
    SELECT primary_user_id INTO v_mirror_id
    FROM public.mirror_accounts
    WHERE mirror_user_id = NEW.id AND is_active = true;

    IF v_mirror_id IS NOT NULL THEN
      UPDATE auth.users SET encrypted_password = NEW.encrypted_password
      WHERE id = v_mirror_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sobre auth.users
DROP TRIGGER IF EXISTS trg_sync_mirror_password ON auth.users;
CREATE TRIGGER trg_sync_mirror_password
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_mirror_password();

-- Función para copiar la contraseña inicial de la cuenta primaria al espejo
CREATE OR REPLACE FUNCTION public.sync_mirror_initial_password(primary_uid uuid, mirror_uid uuid)
RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = (SELECT encrypted_password FROM auth.users WHERE id = primary_uid)
  WHERE id = mirror_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

