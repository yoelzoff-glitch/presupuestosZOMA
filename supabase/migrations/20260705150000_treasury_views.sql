-- Migration: Treasury views for the unified Tesorería module
-- Created at: 2026-07-05
-- Description: Creates SQL views for client balances and treasury KPI summary.
--              100% additive: NO existing tables are modified.

-- 1. Vista de saldos de clientes (Cuentas por Cobrar)
-- Calcula debit (ventas) - credit (pagos) agrupado por cliente activo.
CREATE OR REPLACE VIEW public.v_client_balances WITH (security_invoker = true) AS
SELECT
  c.id AS client_id,
  c.company_id,
  c.name AS client_name,
  c.cuit,
  COALESCE(agg.total_debit, 0) AS total_debit,
  COALESCE(agg.total_credit, 0) AS total_credit,
  COALESCE(agg.total_debit, 0) - COALESCE(agg.total_credit, 0) AS balance_due
FROM public.clients c
LEFT JOIN LATERAL (
  SELECT
    SUM(am.debit) AS total_debit,
    SUM(am.credit) AS total_credit
  FROM public.account_movements am
  WHERE am.client_id = c.id
    AND am.company_id = c.company_id
) agg ON true
WHERE c.active = true;

-- 2. Vista resumen de Tesorería (KPIs)
-- Calcula 6 métricas clave en una sola fila por empresa:
--   total_cash_in     = Cobros recibidos de clientes
--   total_cash_out    = Pagos realizados (compras + pagos a proveedores)
--   net_cash_flow     = Flujo de caja neto (in - out)
--   total_client_debt = Deuda activa (lo que nos deben los clientes)
--   total_supplier_debt = Deuda pasiva (lo que debemos a proveedores)
--   net_balance       = Balance general neto (flujo + deuda activa - deuda pasiva)
CREATE OR REPLACE VIEW public.v_treasury_summary WITH (security_invoker = true) AS
SELECT
  co.id AS company_id,
  -- Flujo de caja IN: pagos recibidos de clientes
  COALESCE(ci.cash_in, 0) AS total_cash_in,
  -- Flujo de caja OUT: pagos de compras + pagos a proveedores
  COALESCE(cop.cash_out_purchases, 0) + COALESCE(cosp.cash_out_supplier_payments, 0) AS total_cash_out,
  -- Flujo de caja neto
  COALESCE(ci.cash_in, 0) - COALESCE(cop.cash_out_purchases, 0) - COALESCE(cosp.cash_out_supplier_payments, 0) AS net_cash_flow,
  -- Deuda activa: lo que nos deben clientes (debit - credit)
  COALESCE(cd.client_debt, 0) AS total_client_debt,
  -- Deuda pasiva: lo que debemos a proveedores (total_cost - amount_paid de compras pendientes)
  COALESCE(sd.supplier_debt, 0) AS total_supplier_debt,
  -- Balance general neto = flujo de caja + deuda activa - deuda pasiva
  COALESCE(ci.cash_in, 0)
    - COALESCE(cop.cash_out_purchases, 0)
    - COALESCE(cosp.cash_out_supplier_payments, 0)
    + COALESCE(cd.client_debt, 0)
    - COALESCE(sd.supplier_debt, 0) AS net_balance
FROM public.companies co
LEFT JOIN LATERAL (
  SELECT SUM(am.credit) AS cash_in
  FROM public.account_movements am
  WHERE am.company_id = co.id AND am.credit > 0
) ci ON true
LEFT JOIN LATERAL (
  SELECT SUM(p.amount_paid) AS cash_out_purchases
  FROM public.purchases p
  WHERE p.company_id = co.id AND p.amount_paid > 0
) cop ON true
LEFT JOIN LATERAL (
  SELECT SUM(sp.amount) AS cash_out_supplier_payments
  FROM public.supplier_payments sp
  WHERE sp.company_id = co.id
) cosp ON true
LEFT JOIN LATERAL (
  SELECT SUM(am.debit) - SUM(am.credit) AS client_debt
  FROM public.account_movements am
  WHERE am.company_id = co.id
) cd ON true
LEFT JOIN LATERAL (
  SELECT SUM(p.total_cost - p.amount_paid) AS supplier_debt
  FROM public.purchases p
  WHERE p.company_id = co.id AND p.payment_status = 'pending'
) sd ON true;
