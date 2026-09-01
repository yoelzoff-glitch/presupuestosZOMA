-- ==============================================================================
-- MIGRACIÓN SPRINT P0.1: ARCA DISTRIBUTED LOCKS, IDEMPOTENCY & SECURITY HARDENING
-- ==============================================================================

-- 1. TABLA DE LOCKS DISTRIBUIDOS DE EMISIÓN
CREATE TABLE IF NOT EXISTS public.arca_emission_locks (
    lock_key TEXT PRIMARY KEY,
    lock_token UUID NOT NULL,
    locked_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.arca_emission_locks ENABLE ROW LEVEL SECURITY;

-- 2. TABLA DE LOCKS DISTRIBUIDOS DE TICKETS WSAA
CREATE TABLE IF NOT EXISTS public.arca_wsaa_locks (
    lock_key TEXT PRIMARY KEY,
    lock_token UUID NOT NULL,
    locked_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.arca_wsaa_locks ENABLE ROW LEVEL SECURITY;

-- 3. RPC: CLAIM EMISSION LOCK
CREATE OR REPLACE FUNCTION public.claim_arca_emission_lock(
    p_lock_key TEXT,
    p_lock_token UUID,
    p_lease_seconds INTEGER DEFAULT 120
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_acquired BOOLEAN := FALSE;
    v_now TIMESTAMPTZ := NOW();
    v_until TIMESTAMPTZ := NOW() + (p_lease_seconds || ' seconds')::INTERVAL;
BEGIN
    INSERT INTO public.arca_emission_locks (
        lock_key,
        lock_token,
        locked_until,
        created_at,
        updated_at
    ) VALUES (
        p_lock_key,
        p_lock_token,
        v_until,
        v_now,
        v_now
    )
    ON CONFLICT (lock_key) DO UPDATE
    SET
        lock_token = p_lock_token,
        locked_until = v_until,
        updated_at = v_now
    WHERE public.arca_emission_locks.locked_until < v_now;

    IF FOUND THEN
        v_acquired := TRUE;
    END IF;

    RETURN v_acquired;
END;
$$;

-- 4. RPC: RELEASE EMISSION LOCK
CREATE OR REPLACE FUNCTION public.release_arca_emission_lock(
    p_lock_key TEXT,
    p_lock_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_released BOOLEAN := FALSE;
BEGIN
    DELETE FROM public.arca_emission_locks
    WHERE lock_key = p_lock_key AND lock_token = p_lock_token;

    IF FOUND THEN
        v_released := TRUE;
    END IF;

    RETURN v_released;
END;
$$;

-- 5. RPC: CLAIM WSAA LOCK
CREATE OR REPLACE FUNCTION public.claim_arca_wsaa_lock(
    p_lock_key TEXT,
    p_lock_token UUID,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_acquired BOOLEAN := FALSE;
    v_now TIMESTAMPTZ := NOW();
    v_until TIMESTAMPTZ := NOW() + (p_lease_seconds || ' seconds')::INTERVAL;
BEGIN
    INSERT INTO public.arca_wsaa_locks (
        lock_key,
        lock_token,
        locked_until,
        created_at,
        updated_at
    ) VALUES (
        p_lock_key,
        p_lock_token,
        v_until,
        v_now,
        v_now
    )
    ON CONFLICT (lock_key) DO UPDATE
    SET
        lock_token = p_lock_token,
        locked_until = v_until,
        updated_at = v_now
    WHERE public.arca_wsaa_locks.locked_until < v_now;

    IF FOUND THEN
        v_acquired := TRUE;
    END IF;

    RETURN v_acquired;
END;
$$;

-- 6. RPC: RELEASE WSAA LOCK
CREATE OR REPLACE FUNCTION public.release_arca_wsaa_lock(
    p_lock_key TEXT,
    p_lock_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_released BOOLEAN := FALSE;
BEGIN
    DELETE FROM public.arca_wsaa_locks
    WHERE lock_key = p_lock_key AND lock_token = p_lock_token;

    IF FOUND THEN
        v_released := TRUE;
    END IF;

    RETURN v_released;
END;
$$;

-- 7. RPC ATÓMICA DE RECLAMO DE INTENTO
CREATE OR REPLACE FUNCTION public.claim_arca_invoice_attempt(
    p_company_id UUID,
    p_budget_id UUID,
    p_environment TEXT,
    p_operation_type TEXT,
    p_idempotency_key TEXT,
    p_punto_venta INTEGER,
    p_comprobante_tipo INTEGER,
    p_request_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_existing public.arca_invoice_attempts%ROWTYPE;
    v_attempt public.arca_invoice_attempts%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Bloquear y consultar fila si ya existe
    SELECT * INTO v_existing
    FROM public.arca_invoice_attempts
    WHERE idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        -- 1. Si ya está persistido, devolver persistido
        IF v_existing.status = 'persisted' THEN
            RETURN jsonb_build_object(
                'type', 'persisted',
                'attempt', row_to_json(v_existing)
            );
        END IF;

        -- 2. Si está en authorized_pending_persistence o reconciliation_required
        IF v_existing.status IN ('authorized_pending_persistence', 'reconciliation_required') THEN
            RETURN jsonb_build_object(
                'type', 'needs_reconciliation',
                'attempt', row_to_json(v_existing)
            );
        END IF;

        -- 3. Si está en processing pero ya tiene comprobante_numero planificado asignado
        IF v_existing.status = 'processing' AND v_existing.comprobante_numero IS NOT NULL THEN
            RETURN jsonb_build_object(
                'type', 'needs_reconciliation',
                'attempt', row_to_json(v_existing)
            );
        END IF;

        -- 4. Si está en processing reciente (< 30s) sin comprobante_numero
        IF v_existing.status = 'processing' AND v_existing.updated_at > (v_now - INTERVAL '30 seconds') THEN
            RETURN jsonb_build_object(
                'type', 'conflict_processing',
                'attempt', row_to_json(v_existing)
            );
        END IF;

        -- 5. Si falló previamente (rejected) o el lock de processing expiró: reactivar reclamo
        UPDATE public.arca_invoice_attempts
        SET
            status = 'processing',
            punto_venta = p_punto_venta,
            comprobante_tipo = p_comprobante_tipo,
            request_payload = p_request_payload,
            updated_at = v_now
        WHERE id = v_existing.id
        RETURNING * INTO v_attempt;

        RETURN jsonb_build_object(
            'type', 'claimed',
            'attempt', row_to_json(v_attempt)
        );
    ELSE
        -- Insertar nuevo intento
        INSERT INTO public.arca_invoice_attempts (
            company_id,
            budget_id,
            environment,
            operation_type,
            idempotency_key,
            status,
            punto_venta,
            comprobante_tipo,
            request_payload,
            created_at,
            updated_at
        ) VALUES (
            p_company_id,
            p_budget_id,
            p_environment,
            p_operation_type,
            p_idempotency_key,
            'processing',
            p_punto_venta,
            p_comprobante_tipo,
            p_request_payload,
            v_now,
            v_now
        ) RETURNING * INTO v_attempt;

        RETURN jsonb_build_object(
            'type', 'claimed',
            'attempt', row_to_json(v_attempt)
        );
    END IF;
END;
$$;

-- 8. RPC TRANSACCIONAL DE PERSISTENCIA ACTUALIZADA (SEGURIDAD Y NOTAS PARCIALES)
CREATE OR REPLACE FUNCTION public.persist_arca_invoice_atomic(
    p_attempt_id UUID,
    p_company_id UUID,
    p_budget_id UUID,
    p_client_id UUID,
    p_is_corrective BOOLEAN,
    p_is_credit_note BOOLEAN,
    p_total_amount NUMERIC,
    p_cae TEXT,
    p_cae_expires_at DATE,
    p_comprobante_numero INTEGER,
    p_comprobante_tipo INTEGER,
    p_invoice_date TEXT,
    p_servicio_desde TEXT DEFAULT NULL,
    p_servicio_hasta TEXT DEFAULT NULL,
    p_servicio_vto TEXT DEFAULT NULL,
    p_is_total_cancellation BOOLEAN DEFAULT TRUE,
    p_invoice_original_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_attempt public.arca_invoice_attempts%ROWTYPE;
    v_budget_company_id UUID;
    v_client_company_id UUID;
    v_invoice_id UUID;
    v_existing_invoice_id UUID;
    v_rows_affected INTEGER;
BEGIN
    -- 1. Validar intento
    SELECT * INTO v_attempt
    FROM public.arca_invoice_attempts
    WHERE id = p_attempt_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El intento de emisión % no existe', p_attempt_id;
    END IF;

    IF v_attempt.company_id <> p_company_id THEN
        RAISE EXCEPTION 'El intento % no pertenece a la empresa %', p_attempt_id, p_company_id;
    END IF;

    IF v_attempt.status = 'persisted' THEN
        RAISE EXCEPTION 'El intento % ya ha sido persistido previamente', p_attempt_id;
    END IF;

    IF v_attempt.punto_venta <> (SELECT punto_venta FROM public.arca_invoice_attempts WHERE id = p_attempt_id) THEN
        RAISE EXCEPTION 'Discrepancia en punto de venta para el intento %', p_attempt_id;
    END IF;

    -- 2. Validar pertenencia de budget y client
    SELECT company_id INTO v_budget_company_id
    FROM public.budgets
    WHERE id = p_budget_id;

    IF NOT FOUND OR v_budget_company_id <> p_company_id THEN
        RAISE EXCEPTION 'El presupuesto % no existe o no pertenece a la empresa %', p_budget_id, p_company_id;
    END IF;

    SELECT company_id INTO v_client_company_id
    FROM public.clients
    WHERE id = p_client_id;

    IF NOT FOUND OR v_client_company_id <> p_company_id THEN
        RAISE EXCEPTION 'El cliente % no existe o no pertenece a la empresa %', p_client_id, p_company_id;
    END IF;

    -- 3. Persistencia de comprobante
    IF p_is_corrective THEN
        -- Si es Nota de Crédito con anulación total, cancelar la factura original específica
        IF p_is_credit_note AND p_is_total_cancellation THEN
            IF p_invoice_original_id IS NOT NULL THEN
                UPDATE public.invoices
                SET status = 'cancelled', updated_at = NOW()
                WHERE id = p_invoice_original_id AND company_id = p_company_id;
            ELSE
                UPDATE public.invoices
                SET status = 'cancelled', updated_at = NOW()
                WHERE budget_id = p_budget_id AND company_id = p_company_id AND status = 'emitted';
            END IF;
        END IF;

        -- Insertar comprobante correctivo como nueva fila en invoices
        INSERT INTO public.invoices (
            company_id,
            client_id,
            budget_id,
            status,
            total_amount,
            afip_cae,
            afip_cae_vencimiento,
            afip_comprobante_numero,
            afip_comprobante_tipo,
            invoice_date,
            invoice_number,
            afip_servicio_desde,
            afip_servicio_hasta,
            afip_servicio_vto
        ) VALUES (
            p_company_id,
            p_client_id,
            p_budget_id,
            'emitted',
            CASE WHEN p_is_credit_note THEN -ABS(p_total_amount) ELSE ABS(p_total_amount) END,
            p_cae,
            p_cae_expires_at,
            p_comprobante_numero,
            p_comprobante_tipo,
            p_invoice_date,
            p_comprobante_numero::text,
            p_servicio_desde,
            p_servicio_hasta,
            p_servicio_vto
        ) RETURNING id INTO v_invoice_id;

    ELSE
        -- Factura Original: Actualizar budget
        UPDATE public.budgets
        SET
            afip_cae = p_cae,
            afip_cae_vencimiento = p_cae_expires_at,
            afip_comprobante_numero = p_comprobante_numero,
            afip_comprobante_tipo = p_comprobante_tipo,
            status = 'issued',
            updated_at = NOW()
        WHERE id = p_budget_id AND company_id = p_company_id;

        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        IF v_rows_affected = 0 THEN
            RAISE EXCEPTION 'No se pudo actualizar el estado del presupuesto %', p_budget_id;
        END IF;

        -- Buscar invoice borrador existente para este presupuesto
        SELECT id INTO v_existing_invoice_id
        FROM public.invoices
        WHERE budget_id = p_budget_id AND company_id = p_company_id
        LIMIT 1;

        IF v_existing_invoice_id IS NOT NULL THEN
            UPDATE public.invoices
            SET
                status = 'emitted',
                total_amount = p_total_amount,
                afip_cae = p_cae,
                afip_cae_vencimiento = p_cae_expires_at,
                afip_comprobante_numero = p_comprobante_numero,
                afip_comprobante_tipo = p_comprobante_tipo,
                invoice_date = p_invoice_date,
                invoice_number = p_comprobante_numero::text,
                afip_servicio_desde = p_servicio_desde,
                afip_servicio_hasta = p_servicio_hasta,
                afip_servicio_vto = p_servicio_vto,
                updated_at = NOW()
            WHERE id = v_existing_invoice_id
            RETURNING id INTO v_invoice_id;
        ELSE
            INSERT INTO public.invoices (
                company_id,
                client_id,
                budget_id,
                status,
                total_amount,
                afip_cae,
                afip_cae_vencimiento,
                afip_comprobante_numero,
                afip_comprobante_tipo,
                invoice_date,
                invoice_number,
                afip_servicio_desde,
                afip_servicio_hasta,
                afip_servicio_vto
            ) VALUES (
                p_company_id,
                p_client_id,
                p_budget_id,
                'emitted',
                p_total_amount,
                p_cae,
                p_cae_expires_at,
                p_comprobante_numero,
                p_comprobante_tipo,
                p_invoice_date,
                p_comprobante_numero::text,
                p_servicio_desde,
                p_servicio_hasta,
                p_servicio_vto
            ) RETURNING id INTO v_invoice_id;
        END IF;
    END IF;

    -- 4. Actualizar intento a persisted
    UPDATE public.arca_invoice_attempts
    SET
        status = 'persisted',
        comprobante_numero = p_comprobante_numero,
        cae = p_cae,
        cae_expires_at = p_cae_expires_at,
        updated_at = NOW()
    WHERE id = p_attempt_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected = 0 THEN
        RAISE EXCEPTION 'No se pudo actualizar el intento % a persisted', p_attempt_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'comprobante_numero', p_comprobante_numero,
        'cae', p_cae
    );
END;
$$;

-- 9. REVOCACIÓN DE PERMISOS DE SEGURIDAD (EXCLUSIVO SERVICE_ROLE)
REVOKE ALL ON FUNCTION public.claim_arca_emission_lock(TEXT, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_arca_emission_lock(TEXT, UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.release_arca_emission_lock(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_arca_emission_lock(TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.claim_arca_wsaa_lock(TEXT, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_arca_wsaa_lock(TEXT, UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.release_arca_wsaa_lock(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_arca_wsaa_lock(TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.claim_arca_invoice_attempt(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_arca_invoice_attempt(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.persist_arca_invoice_atomic(UUID, UUID, UUID, UUID, BOOLEAN, BOOLEAN, NUMERIC, TEXT, DATE, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_arca_invoice_atomic(UUID, UUID, UUID, UUID, BOOLEAN, BOOLEAN, NUMERIC, TEXT, DATE, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID) TO service_role;
