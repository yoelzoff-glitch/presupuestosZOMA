-- Migration: Purchases Calculator and Supplier Movements Record Type
-- Created at: 2026-07-10

-- 1. Agregar campos a purchases para documentar mejor la operación
ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS provider_remito text,
ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal numeric,
ADD COLUMN IF NOT EXISTS total_with_tax numeric,
ADD COLUMN IF NOT EXISTS previous_sale_price numeric,
ADD COLUMN IF NOT EXISTS new_sale_price numeric,
ADD COLUMN IF NOT EXISTS sale_price_updated boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS stock_movement_id uuid,
ADD COLUMN IF NOT EXISTS supplier_movement_purchase_id uuid,
ADD COLUMN IF NOT EXISTS supplier_movement_payment_id uuid;

-- 2. Asegurar columna record_type en supplier_movements para aislamiento por Empresa y Espejos
ALTER TABLE public.supplier_movements
ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'blanco'
CHECK (record_type IN ('blanco', 'x'));

-- 3. Re-crear RLS para supplier_movements con segregación de record_type
DROP POLICY IF EXISTS "Aislamiento por Empresa" ON public.supplier_movements;
CREATE POLICY "Aislamiento por Empresa" ON public.supplier_movements FOR ALL
USING (
  is_member_of(company_id)
  AND (record_type = 'blanco' OR NOT is_mirror_user())
);

-- 4. Definir la función RPC para registrar la compra de forma transaccional (ACID)
CREATE OR REPLACE FUNCTION public.register_supplier_purchase(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_product_id uuid;
  v_supplier_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_tax_rate numeric;
  v_tax_amount numeric;
  v_subtotal numeric;
  v_total_with_tax numeric;
  v_operation_date date;
  v_provider_invoice text;
  v_provider_remito text;
  v_notes text;
  v_payment_status text;
  v_amount_paid numeric;
  v_payment_method text;
  v_update_sale_price boolean;
  v_new_sale_price numeric;
  v_record_type text;

  v_product_name text;
  v_product_code text;
  v_track_stock boolean;
  v_current_cost numeric;
  v_current_sale_price numeric;
  v_current_stock numeric;

  v_purchase_id uuid;
  v_stock_movement_id uuid := NULL;
  v_supplier_mov_purchase_id uuid := NULL;
  v_supplier_mov_payment_id uuid := NULL;

  v_supplier_name text;
  v_response jsonb;
BEGIN
  -- Extract values from JSON payload
  v_company_id := (payload->>'company_id')::uuid;
  v_user_id := (payload->>'user_id')::uuid;
  v_product_id := (payload->>'product_id')::uuid;
  v_supplier_id := (payload->>'supplier_id')::uuid;
  v_quantity := (payload->>'quantity')::numeric;
  v_unit_cost := (payload->>'unit_cost')::numeric;
  v_tax_rate := COALESCE((payload->>'tax_rate')::numeric, 0);
  v_operation_date := COALESCE((payload->>'operation_date')::date, CURRENT_DATE);
  v_provider_invoice := payload->>'provider_invoice';
  v_provider_remito := payload->>'provider_remito';
  v_notes := payload->>'notes';
  v_payment_status := payload->>'payment_status';
  v_amount_paid := COALESCE((payload->>'amount_paid')::numeric, 0);
  v_payment_method := payload->>'payment_method';
  v_update_sale_price := COALESCE((payload->>'update_sale_price')::boolean, false);
  v_new_sale_price := (payload->>'new_sale_price')::numeric;
  v_record_type := COALESCE(payload->>'record_type', 'blanco');

  -- Validar empresa/usuario
  IF NOT EXISTS (
    SELECT 1 FROM public.users_profiles
    WHERE id = v_user_id AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Usuario no autorizado para esta empresa';
  END IF;

  -- Bloquear producto con FOR UPDATE
  SELECT name, internal_code, track_stock, cost_price, sale_price, COALESCE(stock_quantity, 0)
  INTO v_product_name, v_product_code, v_track_stock, v_current_cost, v_current_sale_price, v_current_stock
  FROM public.products
  WHERE id = v_product_id AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto seleccionado no existe o no pertenece a la empresa';
  END IF;

  -- Obtener nombre del proveedor
  SELECT name INTO v_supplier_name
  FROM public.suppliers
  WHERE id = v_supplier_id AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El proveedor seleccionado no existe o no pertenece a la empresa';
  END IF;

  -- Validar que no se ingrese record_type inválido
  IF v_record_type NOT IN ('blanco', 'x') THEN
    v_record_type := 'blanco';
  END IF;

  -- Si es cuenta espejo, forzar record_type a 'blanco'
  IF EXISTS (
    SELECT 1 FROM public.mirror_accounts
    WHERE mirror_user_id = v_user_id AND is_active = true
  ) THEN
    v_record_type := 'blanco';
  END IF;

  -- Calcular montos
  v_subtotal := v_quantity * v_unit_cost;
  v_tax_amount := v_subtotal * (v_tax_rate / 100.0);
  v_total_with_tax := v_subtotal + v_tax_amount;

  -- Validaciones de montos
  IF v_amount_paid < 0 THEN
    RAISE EXCEPTION 'El monto pagado no puede ser negativo';
  END IF;
  IF v_amount_paid > v_total_with_tax THEN
    RAISE EXCEPTION 'El monto pagado no puede superar el total de la compra con impuestos';
  END IF;

  -- Si hay pago, debe especificarse método de pago
  IF v_amount_paid > 0 AND (v_payment_method IS NULL OR TRIM(v_payment_method) = '') THEN
    RAISE EXCEPTION 'Debe especificar un método de pago si realiza un pago';
  END IF;

  -- Determinar estado final de pago
  IF v_amount_paid = v_total_with_tax THEN
    v_payment_status := 'paid';
  ELSE
    -- parcial o pendiente
    v_payment_status := 'pending';
  END IF;

  -- Actualizar costo y precio de venta del producto
  UPDATE public.products
  SET cost_price = v_unit_cost,
      sale_price = CASE WHEN v_update_sale_price THEN v_new_sale_price ELSE sale_price END,
      last_price_update = NOW(),
      updated_at = NOW()
  WHERE id = v_product_id;

  -- Impactar stock si track_stock = true
  IF COALESCE(v_track_stock, false) = true THEN
    UPDATE public.products
    SET stock_quantity = COALESCE(stock_quantity, 0) + v_quantity
    WHERE id = v_product_id;

    INSERT INTO public.stock_movements (
      company_id,
      product_id,
      user_id,
      type,
      quantity,
      reason,
      notes
    ) VALUES (
      v_company_id,
      v_product_id,
      v_user_id,
      'Entrada',
      v_quantity,
      'Compra a Proveedor',
      COALESCE(v_notes, 'Compra registrada mediante calculadora')
    ) RETURNING id INTO v_stock_movement_id;
  END IF;

  -- Insertar la compra en purchases
  INSERT INTO public.purchases (
    company_id,
    product_id,
    user_id,
    product_name,
    product_code,
    supplier,
    supplier_id,
    quantity,
    unit_cost,
    previous_cost,
    purchase_date,
    provider_invoice,
    provider_remito,
    tax_rate,
    tax_amount,
    subtotal,
    total_with_tax,
    payment_method,
    payment_status,
    amount_paid,
    notes,
    previous_sale_price,
    new_sale_price,
    sale_price_updated,
    stock_movement_id,
    record_type
  ) VALUES (
    v_company_id,
    v_product_id,
    v_user_id,
    v_product_name,
    v_product_code,
    v_supplier_name,
    v_supplier_id,
    v_quantity,
    v_unit_cost,
    COALESCE(v_current_cost, 0),
    v_operation_date,
    v_provider_invoice,
    v_provider_remito,
    v_tax_rate,
    v_tax_amount,
    v_subtotal,
    v_total_with_tax,
    CASE WHEN v_amount_paid > 0 THEN v_payment_method ELSE NULL END,
    v_payment_status,
    v_amount_paid,
    v_notes,
    v_current_sale_price,
    CASE WHEN v_update_sale_price THEN v_new_sale_price ELSE NULL END,
    v_update_sale_price,
    v_stock_movement_id,
    v_record_type
  ) RETURNING id INTO v_purchase_id;

  -- Crear supplier_movements:
  -- Compra total como credit
  INSERT INTO public.supplier_movements (
    company_id,
    supplier_id,
    purchase_id,
    movement_date,
    movement_type,
    description,
    debit,
    credit,
    record_type
  ) VALUES (
    v_company_id,
    v_supplier_id,
    v_purchase_id,
    v_operation_date,
    'Compra',
    'Compra de ' || v_quantity || ' x ' || v_product_name,
    0,
    v_total_with_tax,
    v_record_type
  ) RETURNING id INTO v_supplier_mov_purchase_id;

  -- Pago total/parcial como debit
  IF v_amount_paid > 0 THEN
    INSERT INTO public.supplier_movements (
      company_id,
      supplier_id,
      purchase_id,
      movement_date,
      movement_type,
      payment_method,
      description,
      debit,
      credit,
      record_type
    ) VALUES (
      v_company_id,
      v_supplier_id,
      v_purchase_id,
      v_operation_date,
      'Pago',
      v_payment_method,
      'Pago de compra a proveedor',
      v_amount_paid,
      0,
      v_record_type
    ) RETURNING id INTO v_supplier_mov_payment_id;
  END IF;

  -- Actualizar referencias en purchases
  UPDATE public.purchases
  SET supplier_movement_purchase_id = v_supplier_mov_purchase_id,
      supplier_movement_payment_id = v_supplier_mov_payment_id
  WHERE id = v_purchase_id;

  -- Armar respuesta
  v_response := jsonb_build_object(
    'purchase_id', v_purchase_id,
    'stock_movement_id', v_stock_movement_id,
    'supplier_movement_purchase_id', v_supplier_mov_purchase_id,
    'supplier_movement_payment_id', v_supplier_mov_payment_id,
    'subtotal', v_subtotal,
    'tax_amount', v_tax_amount,
    'total_with_tax', v_total_with_tax,
    'payment_status', v_payment_status
  );

  RETURN v_response;
END;
$$;
