-- Migration: Create purchases table, indexes, and RLS policies
-- Created at: 2026-07-03

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  product_id uuid NOT NULL,
  user_id uuid,

  -- Datos de la compra
  product_name text NOT NULL,
  product_code text,
  supplier text,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost numeric GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  
  -- Contexto adicional
  previous_cost numeric DEFAULT 0,
  cost_variation numeric GENERATED ALWAYS AS (
    CASE WHEN previous_cost > 0 
      THEN ROUND(((unit_cost - previous_cost) / previous_cost) * 100, 2) 
      ELSE 0 
    END
  ) STORED,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  provider_invoice text,
  payment_method text,
  notes text,

  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT purchases_pkey PRIMARY KEY (id),
  CONSTRAINT purchases_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT purchases_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_purchases_company_id ON public.purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON public.purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON public.purchases(purchase_date DESC);

-- Habilitar RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'Company members can view their purchases'
  ) THEN
    CREATE POLICY "Company members can view their purchases"
      ON public.purchases FOR SELECT
      USING (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'Company members can insert purchases'
  ) THEN
    CREATE POLICY "Company members can insert purchases"
      ON public.purchases FOR INSERT
      WITH CHECK (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'Company members can update their purchases'
  ) THEN
    CREATE POLICY "Company members can update their purchases"
      ON public.purchases FOR UPDATE
      USING (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'Company members can delete their purchases'
  ) THEN
    CREATE POLICY "Company members can delete their purchases"
      ON public.purchases FOR DELETE
      USING (company_id IN (
        SELECT company_id FROM public.users_profiles WHERE id = auth.uid()
      ));
  END IF;
END
$$;
