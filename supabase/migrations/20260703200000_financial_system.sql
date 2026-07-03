-- Migration: Add financial system (suppliers, supplier payments, purchases payment status, ledger view)
-- Created at: 2026-07-03

-- 1. Crear tabla de proveedores (suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  cuit text,
  phone text,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT suppliers_pkey PRIMARY KEY (id),
  CONSTRAINT suppliers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  CONSTRAINT suppliers_company_id_name_unique UNIQUE (company_id, name)
);

-- Índices para proveedores
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);

-- Habilitar RLS en proveedores
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para proveedores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Company members can view their suppliers'
  ) THEN
    CREATE POLICY "Company members can view their suppliers"
      ON public.suppliers FOR SELECT
      USING (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Company members can insert suppliers'
  ) THEN
    CREATE POLICY "Company members can insert suppliers"
      ON public.suppliers FOR INSERT
      WITH CHECK (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Company members can update their suppliers'
  ) THEN
    CREATE POLICY "Company members can update their suppliers"
      ON public.suppliers FOR UPDATE
      USING (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Company members can delete their suppliers'
  ) THEN
    CREATE POLICY "Company members can delete their suppliers"
      ON public.suppliers FOR DELETE
      USING (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;
END
$$;

-- 2. Modificar la tabla purchases para incorporar el sistema de pagos y proveedores normalizados
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status = ANY (ARRAY['paid'::text, 'pending'::text]));
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0 CHECK (amount_paid >= 0);

-- Migrar proveedores existentes en compras a la tabla de proveedores
INSERT INTO public.suppliers (company_id, name)
SELECT DISTINCT company_id, supplier 
FROM public.purchases 
WHERE supplier IS NOT NULL AND TRIM(supplier) <> ''
ON CONFLICT (company_id, name) DO NOTHING;

-- Asociar las compras existentes con sus respectivos supplier_id
UPDATE public.purchases p
SET supplier_id = s.id
FROM public.suppliers s
WHERE p.company_id = s.company_id AND p.supplier = s.name;

-- Actualizar las compras existentes para que tengan payment_status = 'paid' y amount_paid = total_cost
UPDATE public.purchases
SET payment_status = 'paid', amount_paid = total_cost
WHERE amount_paid = 0;

-- 3. Crear tabla de pagos a proveedores (supplier_payments)
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  purchase_id uuid,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  description text,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT supplier_payments_pkey PRIMARY KEY (id),
  CONSTRAINT supplier_payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  CONSTRAINT supplier_payments_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE,
  CONSTRAINT supplier_payments_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL,
  CONSTRAINT supplier_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Índices para pagos a proveedores
CREATE INDEX IF NOT EXISTS idx_supplier_payments_company_id ON public.supplier_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_id ON public.supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_payment_date ON public.supplier_payments(payment_date DESC);

-- Habilitar RLS en pagos a proveedores
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para pagos a proveedores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_payments' AND policyname = 'Company members can view their supplier payments'
  ) THEN
    CREATE POLICY "Company members can view their supplier payments"
      ON public.supplier_payments FOR SELECT
      USING (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_payments' AND policyname = 'Company members can insert supplier payments'
  ) THEN
    CREATE POLICY "Company members can insert supplier payments"
      ON public.supplier_payments FOR INSERT
      WITH CHECK (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_payments' AND policyname = 'Company members can update their supplier payments'
  ) THEN
    CREATE POLICY "Company members can update their supplier payments"
      ON public.supplier_payments FOR UPDATE
      USING (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_payments' AND policyname = 'Company members can delete their supplier payments'
  ) THEN
    CREATE POLICY "Company members can delete their supplier payments"
      ON public.supplier_payments FOR DELETE
      USING (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;
END
$$;

-- 4. Crear la vista SQL de Libro Diario (v_ledger_entries)
CREATE OR REPLACE VIEW public.v_ledger_entries WITH (security_invoker = true) AS
-- Ingresos: Pagos recibidos de clientes
SELECT
  am.id,
  am.company_id,
  am.movement_date AS entry_date,
  'ingreso'::text AS entry_type,
  COALESCE(am.description, 'Pago de cliente'::text) AS concept,
  am.credit AS amount,
  am.payment_method,
  am.created_at,
  'account_movement'::text AS source_table,
  am.id AS source_id
FROM public.account_movements am
WHERE am.credit > 0

UNION ALL

-- Egresos: Pagos iniciales realizados al comprar productos
SELECT
  p.id,
  p.company_id,
  p.purchase_date AS entry_date,
  'egreso'::text AS entry_type,
  ('Compra: '::text || p.product_name || COALESCE(' - '::text || p.supplier, ''::text)) AS concept,
  p.amount_paid AS amount,
  p.payment_method,
  p.created_at,
  'purchase'::text AS source_table,
  p.id AS source_id
FROM public.purchases p
WHERE p.amount_paid > 0

UNION ALL

-- Egresos: Pagos posteriores a proveedores para saldar deudas
SELECT
  sp.id,
  sp.company_id,
  sp.payment_date AS entry_date,
  'egreso'::text AS entry_type,
  ('Pago a Proveedor: '::text || s.name || COALESCE(' - '::text || sp.description, ''::text)) AS concept,
  sp.amount,
  sp.payment_method,
  sp.created_at,
  'supplier_payment'::text AS source_table,
  sp.id AS source_id
FROM public.supplier_payments sp
JOIN public.suppliers s ON sp.supplier_id = s.id;
