-- ==============================================================================
-- MIGRACIÓN ARCA PRODUCTION READY (SPRINT P0)
-- 1. Tabla de credenciales independientes HOMO / PROD con payloads cifrados
-- 2. Tabla de almacenamiento unificado de Tickets de Acceso WSAA cifrados
-- 3. Tabla de intentos de facturación e idempotencia para emisión recuperable
-- 4. Campo de condición IVA explícita en clientes
-- 5. Función RPC transaccional para persistencia segura post-autorización ARCA
-- ==============================================================================

-- 1. TABLA ARCA_CREDENTIALS
CREATE TABLE IF NOT EXISTS public.arca_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    environment TEXT NOT NULL CHECK (environment IN ('homo', 'prod')),
    cuit TEXT NOT NULL,
    punto_venta INTEGER NOT NULL CHECK (punto_venta > 0),
    tipo_contribuyente TEXT NOT NULL CHECK (tipo_contribuyente IN ('monotributo', 'responsable_inscripto', 'exento')),
    certificate_payload JSONB NOT NULL,
    private_key_payload JSONB NOT NULL,
    certificate_fingerprint TEXT NOT NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT arca_credentials_company_environment_key UNIQUE (company_id, environment)
);

ALTER TABLE public.arca_credentials ENABLE ROW LEVEL SECURITY;
-- No se crean políticas para anon ni authenticated: acceso exclusivo vía service_role.

-- 2. TABLA ARCA_WSAA_TICKETS
CREATE TABLE IF NOT EXISTS public.arca_wsaa_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    cuit TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('homo', 'prod')),
    service TEXT NOT NULL,
    encrypted_payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT arca_wsaa_tickets_unique_entry UNIQUE (company_id, cuit, environment, service)
);

ALTER TABLE public.arca_wsaa_tickets ENABLE ROW LEVEL SECURITY;
-- Acceso exclusivo vía service_role.

-- 3. TABLA ARCA_INVOICE_ATTEMPTS
CREATE TABLE IF NOT EXISTS public.arca_invoice_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
    environment TEXT NOT NULL CHECK (environment IN ('homo', 'prod')),
    operation_type TEXT NOT NULL CHECK (operation_type IN ('invoice', 'credit_note', 'debit_note')),
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN (
        'pending',
        'processing',
        'authorized_pending_persistence',
        'persisted',
        'rejected',
        'reconciliation_required'
    )),
    punto_venta INTEGER NOT NULL CHECK (punto_venta > 0),
    comprobante_tipo INTEGER NOT NULL,
    comprobante_numero INTEGER NULL,
    request_payload JSONB NOT NULL,
    arca_response JSONB NULL,
    cae TEXT NULL,
    cae_expires_at DATE NULL,
    error_code TEXT NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arca_invoice_attempts_budget ON public.arca_invoice_attempts(budget_id);
CREATE INDEX IF NOT EXISTS idx_arca_invoice_attempts_company_env ON public.arca_invoice_attempts(company_id, environment);

ALTER TABLE public.arca_invoice_attempts ENABLE ROW LEVEL SECURITY;
-- Acceso exclusivo vía service_role.

-- 4. CONDICIÓN IVA EXPLÍCITA EN CLIENTES
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'condicion_iva'
    ) THEN
        ALTER TABLE public.clients ADD COLUMN condicion_iva TEXT DEFAULT 'consumidor_final' 
            CHECK (condicion_iva IN ('responsable_inscripto', 'monotributo', 'exento', 'consumidor_final'));
    END IF;
END $$;

-- 5. RPC TRANSACCIONAL DE PERSISTENCIA
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
    p_servicio_vto TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice_id UUID;
    v_existing_invoice_id UUID;
BEGIN
    -- 1. Si es correctivo (Nota de Crédito) y es anulación total, actualizar factura previa si corresponde
    IF p_is_corrective THEN
        IF p_is_credit_note THEN
            UPDATE public.invoices
            SET status = 'cancelled', updated_at = NOW()
            WHERE budget_id = p_budget_id AND status = 'emitted';
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
        WHERE id = p_budget_id;

        -- Buscar invoice borrador existente para este presupuesto
        SELECT id INTO v_existing_invoice_id
        FROM public.invoices
        WHERE budget_id = p_budget_id
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

    -- Actualizar el intento como PERSISTED
    UPDATE public.arca_invoice_attempts
    SET 
        status = 'persisted',
        comprobante_numero = p_comprobante_numero,
        cae = p_cae,
        cae_expires_at = p_cae_expires_at,
        updated_at = NOW()
    WHERE id = p_attempt_id;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'comprobante_numero', p_comprobante_numero,
        'cae', p_cae
    );
END;
$$;
