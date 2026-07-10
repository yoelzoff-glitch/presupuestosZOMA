-- Migration: Sistema de Tesorería, Proveedores y Cuenta Corriente
-- Created at: 2026-07-10

-- =========================================================================
-- 1. ADAPTAR Y ASEGURAR PROVEEDORES (suppliers) Y COMPRAS (purchases)
-- =========================================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Habilitar RLS en proveedores
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Re-crear políticas RLS para proveedores (evitando errores de ya existe)
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.suppliers;
CREATE POLICY "Aislamiento por Empresa" ON public.suppliers 
  FOR ALL USING (is_member_of(company_id));

-- Habilitar RLS en compras
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Re-crear políticas RLS para compras (evitando errores de ya existe)
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.purchases;
CREATE POLICY "Aislamiento por Empresa" ON public.purchases 
  FOR ALL USING (is_member_of(company_id));


-- =========================================================================
-- 2. CREAR TABLA DE MOVIMIENTOS DE PROVEEDORES (supplier_movements)
-- =========================================================================
-- Funciona como el libro de cuenta corriente con proveedores.
-- - debit: Pagos realizados por nosotros al proveedor (reduce la deuda).
-- - credit: Compras realizadas al proveedor a crédito (aumenta la deuda).
CREATE TABLE IF NOT EXISTS public.supplier_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  movement_type text NOT NULL CHECK (movement_type IN ('Compra', 'Pago')),
  payment_method text,
  description text,
  debit numeric(15,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(15,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT supplier_movements_pkey PRIMARY KEY (id),
  CONSTRAINT supplier_movements_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  CONSTRAINT supplier_movements_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplier_movements_company_id ON public.supplier_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_movements_supplier_id ON public.supplier_movements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_movements_date ON public.supplier_movements(movement_date DESC);

ALTER TABLE public.supplier_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.supplier_movements;
CREATE POLICY "Aislamiento por Empresa" ON public.supplier_movements 
  FOR ALL USING (is_member_of(company_id));


-- =========================================================================
-- 3. VISTA DE LIBRO DIARIO / HISTORIAL DE CAJA (v_ledger_entries)
-- =========================================================================
-- Une ingresos (pagos recibidos de clientes) y egresos (pagos realizados a proveedores).
CREATE OR REPLACE VIEW public.v_ledger_entries WITH (security_invoker = true) AS
-- Ingresos (Cobros a clientes)
SELECT
  am.id,
  am.company_id,
  am.movement_date AS entry_date,
  'ingreso'::text AS entry_type,
  COALESCE(am.description, 'Pago recibido de cliente'::text) AS concept,
  am.credit AS amount,
  am.payment_method,
  am.created_at,
  'account_movements'::text AS source_table,
  am.id AS source_id
FROM public.account_movements am
WHERE am.credit > 0

UNION ALL

-- Egresos (Pagos a proveedores y compras de contado)
SELECT
  sm.id,
  sm.company_id,
  sm.movement_date AS entry_date,
  'egreso'::text AS entry_type,
  COALESCE(sm.description, 'Pago realizado a proveedor'::text) AS concept,
  sm.debit AS amount,
  sm.payment_method,
  sm.created_at,
  'supplier_movements'::text AS source_table,
  sm.id AS source_id
FROM public.supplier_movements sm
WHERE sm.debit > 0;
