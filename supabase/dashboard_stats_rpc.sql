-- 1. Eliminar versiones anteriores de la función para evitar conflictos por sobrecarga (ambigüedad)
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, INT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, INT, UUID);

-- 2. Crear la función get_dashboard_stats unificada con soporte para filtros de vendedor y métricas de rentabilidad
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    company_id_param UUID, 
    days_filter INT DEFAULT 30, 
    seller_id_param UUID DEFAULT NULL
)
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
            (SELECT COUNT(*) FROM public.clients WHERE company_id = company_id_param AND (seller_id_param IS NULL OR seller_id = seller_id_param)) as clients_count,
            (SELECT COUNT(*) FROM public.products WHERE company_id = company_id_param) as products_count,
            (SELECT COUNT(*) FROM public.budgets WHERE company_id = company_id_param AND created_at >= date_limit AND (seller_id_param IS NULL OR seller_id = seller_id_param)) as budgets_count,
            (SELECT COUNT(*) FROM public.orders WHERE company_id = company_id_param AND created_at >= date_limit AND (seller_id_param IS NULL OR seller_id = seller_id_param)) as orders_count,
            (SELECT COALESCE(SUM(debit - credit), 0) FROM public.account_movements WHERE company_id = company_id_param AND (seller_id_param IS NULL OR client_id IN (SELECT id FROM public.clients WHERE seller_id = seller_id_param))) as total_balance,
            (SELECT COALESCE(SUM(total_amount), 0) FROM public.budgets WHERE company_id = company_id_param AND status != 'cancelled' AND created_at >= date_limit AND (seller_id_param IS NULL OR seller_id = seller_id_param)) as total_budgeted,
            (SELECT COALESCE(SUM(total_amount), 0) FROM public.budgets WHERE company_id = company_id_param AND status = 'approved' AND created_at >= date_limit AND (seller_id_param IS NULL OR seller_id = seller_id_param)) as total_converted,
            (
                SELECT COALESCE(SUM(bi.quantity * p.cost_price), 0) -- Usamos p.cost_price ya que existe en la tabla products
                FROM public.budget_items bi
                JOIN public.budgets b ON bi.budget_id = b.id
                JOIN public.products p ON bi.product_id = p.id
                WHERE b.company_id = company_id_param 
                  AND b.status = 'approved' 
                  AND b.created_at >= date_limit
                  AND (seller_id_param IS NULL OR b.seller_id = seller_id_param)
            ) as total_cost
    ),
    history AS (
        SELECT 
            TO_CHAR(created_at, 'Mon YY') as month_key,
            SUM(total_amount) as total
        FROM public.budgets 
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
        FROM public.budget_items bi
        JOIN public.budgets b ON bi.budget_id = b.id
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
        FROM public.budgets
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
        'totalCost', (SELECT total_cost FROM stats),
        'profitability', (SELECT total_converted - total_cost FROM stats),
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

-- 3. Sincronización de Rol a App Metadata
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
