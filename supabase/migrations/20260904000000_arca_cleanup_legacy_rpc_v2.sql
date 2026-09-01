-- ==============================================================================
-- MIGRACIÓN B (LIMPIEZA POST-DESPLIEGUE): VERIFICACIÓN, CONSTRAINTS Y REMOCIÓN DE RPC V2
-- SPRINT P0.2 — ARCA PRODUCTION GO-LIVE
-- 
-- Ejecutar ÚNICAMENTE después de:
-- 1. Aplicar la migración aditiva 20260903000000_arca_environment_integrity_additive.sql
-- 2. Desplegar la versión de la aplicación que envía p_environment y consume V3
-- 3. Verificar que las emisiones en producción y testing utilizan la firma V3
-- ==============================================================================

BEGIN;

-- 1. VERIFICAR QUE V3 EXISTE Y ESTÁ PROTEGIDA EXCLUSIVAMENTE PARA SERVICE_ROLE
DO $$
DECLARE
    v_v3_oid OID;
    v_has_anon_execute BOOLEAN;
    v_has_auth_execute BOOLEAN;
    v_has_service_execute BOOLEAN;
BEGIN
    SELECT p.oid INTO v_v3_oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'persist_arca_invoice_atomic'
      AND pg_get_function_identity_arguments(p.oid) LIKE '%p_environment text%';

    IF v_v3_oid IS NULL THEN
        RAISE EXCEPTION 'Abortando migración B: la función RPC V3 (persist_arca_invoice_atomic con p_environment) no existe en la base de datos.';
    END IF;

    v_has_anon_execute := has_function_privilege('anon', v_v3_oid, 'EXECUTE');
    v_has_auth_execute := has_function_privilege('authenticated', v_v3_oid, 'EXECUTE');
    v_has_service_execute := has_function_privilege('service_role', v_v3_oid, 'EXECUTE');

    IF v_has_anon_execute OR v_has_auth_execute OR NOT v_has_service_execute THEN
        RAISE EXCEPTION 'Abortando migración B: los permisos de la RPC V3 no son los esperados (anon: %, auth: %, service_role: %).',
            v_has_anon_execute, v_has_auth_execute, v_has_service_execute;
    END IF;
END $$;

-- 2. AGREGAR CHECK CONSTRAINTS NOT VALID A BUDGETS E INVOICES
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_budgets_cae_environment_punto_venta'
    ) THEN
        ALTER TABLE public.budgets 
        ADD CONSTRAINT chk_budgets_cae_environment_punto_venta 
        CHECK (afip_cae IS NULL OR (arca_environment IS NOT NULL AND afip_punto_venta IS NOT NULL)) 
        NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_cae_environment_punto_venta'
    ) THEN
        ALTER TABLE public.invoices 
        ADD CONSTRAINT chk_invoices_cae_environment_punto_venta 
        CHECK (afip_cae IS NULL OR (arca_environment IS NOT NULL AND afip_punto_venta IS NOT NULL)) 
        NOT VALID;
    END IF;
END $$;

-- 3. ELIMINAR LA FIRMA LEGACY V2 (SIN P_ENVIRONMENT)
DROP FUNCTION IF EXISTS public.persist_arca_invoice_atomic(
    UUID, UUID, UUID, UUID,
    BOOLEAN, BOOLEAN, NUMERIC, TEXT, DATE,
    INTEGER, INTEGER,
    TEXT, TEXT, TEXT, TEXT,
    BOOLEAN, UUID
);

-- 4. CONFIRMAR QUE V2 YA NO EXISTE
DO $$
DECLARE
    v_v2_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'persist_arca_invoice_atomic'
          AND pg_get_function_identity_arguments(p.oid) NOT LIKE '%p_environment text%'
    ) INTO v_v2_exists;

    IF v_v2_exists THEN
        RAISE EXCEPTION 'Error: la firma legacy V2 de persist_arca_invoice_atomic todavía existe después del intento de eliminación.';
    END IF;
END $$;

COMMIT;
