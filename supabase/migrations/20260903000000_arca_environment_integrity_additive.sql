-- ==============================================================================
-- MIGRACIÓN A (ADITIVA): INTEGRIDAD DE ENTORNO FISCAL Y RPC ATÓMICA V3
-- SPRINT P0.2 — ARCA PRODUCTION GO-LIVE
-- 
-- 1. Agregar columnas arca_environment, afip_punto_venta e invoice_original_id
-- 2. Índices de integridad, rendimiento y partial unique index para comprobantes fiscales
-- 3. Pre-flight check y constraints únicas por conjunto de columnas
-- 4. Backfill determinístico desde intentos 'persisted' con desempate por id DESC
-- 5. RPC persist_arca_invoice_atomic V3 con todas las validaciones de negocio e idempotencia
-- 6. Mantiene temporalmente la firma V2 para coexistencia sin downtime
-- ==============================================================================

BEGIN;

-- 1. MODIFICAR BUDGETS E INVOICES
DO $$ 
BEGIN
    -- Columns in public.budgets
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'budgets' AND column_name = 'arca_environment'
    ) THEN
        ALTER TABLE public.budgets ADD COLUMN arca_environment TEXT NULL CHECK (arca_environment IN ('homo', 'prod'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'budgets' AND column_name = 'afip_punto_venta'
    ) THEN
        ALTER TABLE public.budgets ADD COLUMN afip_punto_venta INTEGER NULL CHECK (afip_punto_venta > 0);
    END IF;

    -- Columns in public.invoices
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'arca_environment'
    ) THEN
        ALTER TABLE public.invoices ADD COLUMN arca_environment TEXT NULL CHECK (arca_environment IN ('homo', 'prod'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'afip_punto_venta'
    ) THEN
        ALTER TABLE public.invoices ADD COLUMN afip_punto_venta INTEGER NULL CHECK (afip_punto_venta > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'invoice_original_id'
    ) THEN
        ALTER TABLE public.invoices ADD COLUMN invoice_original_id UUID NULL REFERENCES public.invoices(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- 2. ÍNDICES DE RENDIMIENTO E INTEGRIDAD
CREATE INDEX IF NOT EXISTS idx_budgets_company_environment ON public.budgets (company_id, arca_environment);
CREATE INDEX IF NOT EXISTS idx_invoices_company_environment ON public.invoices (company_id, arca_environment);
CREATE INDEX IF NOT EXISTS idx_invoices_budget_id ON public.invoices (budget_id);
CREATE INDEX IF NOT EXISTS idx_invoices_comprobante ON public.invoices (afip_comprobante_tipo, afip_punto_venta);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_original_id ON public.invoices (invoice_original_id);

-- Índice único parcial para evitar duplicación de comprobantes fiscales autorizados
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_fiscal_voucher 
ON public.invoices (company_id, arca_environment, afip_punto_venta, afip_comprobante_tipo, afip_comprobante_numero)
WHERE afip_cae IS NOT NULL;

-- 3. PRE-FLIGHT CHECK Y CONSTRAINTS ÚNICAS POR CONJUNTO DE COLUMNAS
DO $$
DECLARE
    v_has_credentials_uq BOOLEAN;
    v_has_tickets_uq BOOLEAN;
    v_has_attempts_uq BOOLEAN;
BEGIN
    -- Verificar constraint única en arca_credentials (company_id, environment)
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' 
          AND t.relname = 'arca_credentials'
          AND c.contype IN ('u', 'p')
          AND ARRAY(
              SELECT a.attname::TEXT 
              FROM unnest(c.conkey) AS k 
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k 
              ORDER BY a.attname
          ) = ARRAY['company_id', 'environment']
    ) INTO v_has_credentials_uq;

    IF NOT v_has_credentials_uq THEN
        ALTER TABLE public.arca_credentials 
        ADD CONSTRAINT uq_arca_credentials_company_env UNIQUE (company_id, environment);
    END IF;

    -- Verificar constraint única en arca_wsaa_tickets (company_id, cuit, environment, service)
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' 
          AND t.relname = 'arca_wsaa_tickets'
          AND c.contype IN ('u', 'p')
          AND ARRAY(
              SELECT a.attname::TEXT 
              FROM unnest(c.conkey) AS k 
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k 
              ORDER BY a.attname
          ) = ARRAY['company_id', 'cuit', 'environment', 'service']
    ) INTO v_has_tickets_uq;

    IF NOT v_has_tickets_uq THEN
        ALTER TABLE public.arca_wsaa_tickets 
        ADD CONSTRAINT uq_arca_wsaa_tickets_company_cuit_env_service UNIQUE (company_id, cuit, environment, service);
    END IF;

    -- Verificar constraint única en arca_invoice_attempts (idempotency_key)
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' 
          AND t.relname = 'arca_invoice_attempts'
          AND c.contype IN ('u', 'p')
          AND ARRAY(
              SELECT a.attname::TEXT 
              FROM unnest(c.conkey) AS k 
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k 
              ORDER BY a.attname
          ) = ARRAY['idempotency_key']
    ) INTO v_has_attempts_uq;

    IF NOT v_has_attempts_uq THEN
        ALTER TABLE public.arca_invoice_attempts 
        ADD CONSTRAINT uq_arca_invoice_attempts_idempotency_key UNIQUE (idempotency_key);
    END IF;
END $$;

-- 4. BACKFILL DETERMINÍSTICO DESDE INTENTOS 'persisted' CON DESEMPATE POR ID DESC
WITH latest_attempt_budget AS (
    SELECT DISTINCT ON (budget_id, cae)
        budget_id,
        cae,
        environment,
        punto_venta
    FROM public.arca_invoice_attempts
    WHERE status = 'persisted'
      AND operation_type = 'invoice'
      AND environment IN ('homo', 'prod')
    ORDER BY budget_id, cae, updated_at DESC, id DESC
)
UPDATE public.budgets b
SET 
    arca_environment = a.environment,
    afip_punto_venta = a.punto_venta
FROM latest_attempt_budget a
WHERE b.id = a.budget_id 
  AND b.afip_cae IS NOT NULL 
  AND b.afip_cae = a.cae
  AND b.arca_environment IS NULL;

WITH latest_attempt_invoice AS (
    SELECT DISTINCT ON (budget_id, cae)
        budget_id,
        cae,
        environment,
        punto_venta
    FROM public.arca_invoice_attempts
    WHERE status = 'persisted'
      AND environment IN ('homo', 'prod')
    ORDER BY budget_id, cae, updated_at DESC, id DESC
)
UPDATE public.invoices i
SET 
    arca_environment = a.environment,
    afip_punto_venta = a.punto_venta
FROM latest_attempt_invoice a
WHERE i.budget_id = a.budget_id 
  AND i.afip_cae IS NOT NULL 
  AND i.afip_cae = a.cae
  AND i.arca_environment IS NULL;

-- 5. RPC ATÓMICA V3 CON ENTORNO EXPLÍCITO Y MÁXIMA SEGURIDAD TRANSACCIONAL
CREATE OR REPLACE FUNCTION public.persist_arca_invoice_atomic(
    p_attempt_id UUID,
    p_company_id UUID,
    p_budget_id UUID,
    p_client_id UUID,
    p_environment TEXT,
    p_is_corrective BOOLEAN,
    p_is_credit_note BOOLEAN,
    p_is_total_cancellation BOOLEAN DEFAULT TRUE,
    p_total_amount NUMERIC DEFAULT 0,
    p_cae TEXT DEFAULT NULL,
    p_cae_expires_at DATE DEFAULT NULL,
    p_comprobante_numero INTEGER DEFAULT 0,
    p_comprobante_tipo INTEGER DEFAULT 0,
    p_invoice_date TEXT DEFAULT NULL,
    p_servicio_desde TEXT DEFAULT NULL,
    p_servicio_hasta TEXT DEFAULT NULL,
    p_servicio_vto TEXT DEFAULT NULL,
    p_invoice_original_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_attempt RECORD;
    v_budget RECORD;
    v_client_company_id UUID;
    v_original_invoice RECORD;
    v_existing_invoice RECORD;
    v_target_invoice_id UUID;
    v_total_credited NUMERIC;
    v_remaining_balance NUMERIC;
    v_updated_rows INTEGER;
BEGIN
    -- 1. Validar parámetros de entrada
    IF p_environment NOT IN ('homo', 'prod') THEN
        RAISE EXCEPTION 'Entorno fiscal inválido: %. Debe ser homo o prod.', p_environment;
    END IF;

    IF p_cae IS NULL OR NOT (p_cae ~ '^\d{14}$') THEN
        RAISE EXCEPTION 'El CAE es obligatorio y debe contener exactamente 14 dígitos numéricos.';
    END IF;

    IF p_cae_expires_at IS NULL THEN
        RAISE EXCEPTION 'La fecha de vencimiento del CAE es obligatoria.';
    END IF;

    IF p_comprobante_numero <= 0 THEN
        RAISE EXCEPTION 'El número de comprobante debe ser mayor a 0.';
    END IF;

    IF p_invoice_date IS NULL OR NOT (p_invoice_date ~ '^\d{4}-\d{2}-\d{2}$') THEN
        RAISE EXCEPTION 'La fecha del comprobante es obligatoria y debe tener formato YYYY-MM-DD.';
    END IF;

    IF p_total_amount <= 0 THEN
        RAISE EXCEPTION 'El importe total del comprobante debe ser mayor a cero.';
    END IF;

    IF p_total_amount <> ROUND(p_total_amount, 2) THEN
        RAISE EXCEPTION 'El importe total debe tener como máximo 2 decimales.';
    END IF;

    -- 2. Bloqueo pesimista del intento (FOR UPDATE)
    SELECT * INTO v_attempt
    FROM public.arca_invoice_attempts
    WHERE id = p_attempt_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Intento de facturación % no encontrado.', p_attempt_id;
    END IF;

    -- 3. Validaciones de coherencia e integridad sobre el intento
    IF v_attempt.company_id <> p_company_id THEN
        RAISE EXCEPTION 'Inconsistencia de seguridad: el intento no pertenece a la empresa.';
    END IF;

    IF v_attempt.budget_id <> p_budget_id THEN
        RAISE EXCEPTION 'Inconsistencia de seguridad: el intento no pertenece al presupuesto indicado.';
    END IF;

    IF v_attempt.environment <> p_environment THEN
        RAISE EXCEPTION 'Inconsistencia de seguridad: el entorno del intento (%) no coincide con el solicitado (%).', v_attempt.environment, p_environment;
    END IF;

    IF v_attempt.comprobante_tipo <> p_comprobante_tipo THEN
        RAISE EXCEPTION 'Inconsistencia de tipo de comprobante en el intento.';
    END IF;

    IF v_attempt.comprobante_numero IS NOT NULL AND v_attempt.comprobante_numero <> p_comprobante_numero THEN
        RAISE EXCEPTION 'Inconsistencia en el número de comprobante planificado vs autorizado.';
    END IF;

    IF v_attempt.cae IS NOT NULL AND v_attempt.cae <> p_cae THEN
        RAISE EXCEPTION 'El intento ya posee un CAE asignado diferente (%).', v_attempt.cae;
    END IF;

    -- Validar coherencia de la operación según attempt.operation_type
    IF v_attempt.operation_type = 'invoice' THEN
        IF p_is_corrective THEN
            RAISE EXCEPTION 'Incoherencia: el intento es de tipo factura pero se recibió is_corrective=true.';
        END IF;
        IF p_comprobante_tipo NOT IN (1, 6, 11) THEN
            RAISE EXCEPTION 'Incoherencia: tipo de comprobante (%) no válido para facturas originales.', p_comprobante_tipo;
        END IF;
        IF p_invoice_original_id IS NOT NULL THEN
            RAISE EXCEPTION 'Incoherencia: una factura original no debe recibir invoice_original_id.';
        END IF;
    ELSIF v_attempt.operation_type = 'credit_note' THEN
        IF NOT p_is_corrective OR NOT p_is_credit_note THEN
            RAISE EXCEPTION 'Incoherencia: el intento es de tipo credit_note pero faltan flags de nota de crédito.';
        END IF;
        IF p_comprobante_tipo NOT IN (3, 8, 13) THEN
            RAISE EXCEPTION 'Incoherencia: tipo de comprobante (%) no válido para notas de crédito.', p_comprobante_tipo;
        END IF;
        IF p_invoice_original_id IS NULL THEN
            RAISE EXCEPTION 'Incoherencia: nota de crédito requiere invoice_original_id obligatorio.';
        END IF;
    ELSIF v_attempt.operation_type = 'debit_note' THEN
        IF NOT p_is_corrective OR p_is_credit_note THEN
            RAISE EXCEPTION 'Incoherencia: el intento es de tipo debit_note pero los flags de corrección no coinciden.';
        END IF;
        IF p_comprobante_tipo NOT IN (2, 7, 12) THEN
            RAISE EXCEPTION 'Incoherencia: tipo de comprobante (%) no válido para notas de débito.', p_comprobante_tipo;
        END IF;
        IF p_invoice_original_id IS NULL THEN
            RAISE EXCEPTION 'Incoherencia: nota de débito requiere invoice_original_id obligatorio.';
        END IF;
    END IF;

    -- 4. Validar integridad de la empresa y cliente en el presupuesto ANTES de cualquier resolución idempotente
    SELECT * INTO v_budget
    FROM public.budgets
    WHERE id = p_budget_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Presupuesto % no encontrado.', p_budget_id;
    END IF;

    IF v_budget.company_id <> p_company_id THEN
        RAISE EXCEPTION 'El presupuesto no pertenece a la empresa.';
    END IF;

    IF v_budget.client_id <> p_client_id THEN
        RAISE EXCEPTION 'El cliente no coincide con el receptor asignado al presupuesto.';
    END IF;

    -- Validar que el cliente pertenezca a la misma empresa
    SELECT company_id INTO v_client_company_id
    FROM public.clients
    WHERE id = p_client_id;

    IF NOT FOUND OR v_client_company_id <> p_company_id THEN
        RAISE EXCEPTION 'El cliente no existe o no pertenece a la empresa.';
    END IF;

    -- Control de CAE previo en el presupuesto
    IF v_budget.afip_cae IS NOT NULL THEN
        IF v_budget.arca_environment IS NULL THEN
            RAISE EXCEPTION 'El presupuesto cuenta con un comprobante previo no clasificado. Debe clasificarse antes de emitir.';
        END IF;

        IF v_budget.arca_environment <> p_environment THEN
            RAISE EXCEPTION 'El presupuesto ya cuenta con un comprobante emitido en % y no puede reutilizarse en %.', v_budget.arca_environment, p_environment;
        END IF;

        IF NOT p_is_corrective AND v_budget.afip_cae <> p_cae THEN
            RAISE EXCEPTION 'El presupuesto ya cuenta con otro CAE emitido (%). No puede ser reemplazado.', v_budget.afip_cae;
        END IF;
    END IF;

    -- 5. Idempotencia en el intento: si ya está persistido y pasó las validaciones de empresa/cliente
    IF v_attempt.status = 'persisted' THEN
        IF v_attempt.cae = p_cae 
           AND v_attempt.comprobante_numero = p_comprobante_numero THEN
            RETURN jsonb_build_object(
                'success', true,
                'cae', p_cae,
                'comprobante_numero', p_comprobante_numero,
                'punto_venta', v_attempt.punto_venta,
                'environment', p_environment,
                'status', 'persisted',
                'idempotent', true
            );
        ELSE
            RAISE EXCEPTION 'El intento % ya fue persistido previamente con datos discrepantes.', p_attempt_id;
        END IF;
    END IF;

    -- Permitir persistencia únicamente desde estados controlados
    IF v_attempt.status NOT IN ('processing', 'authorized_pending_persistence', 'reconciliation_required') THEN
        RAISE EXCEPTION 'Estado de intento no válido para persistencia: %.', v_attempt.status;
    END IF;

    -- 6. Idempotencia local en la tabla invoices antes de cualquier inserción o modificación
    SELECT * INTO v_existing_invoice
    FROM public.invoices
    WHERE company_id = p_company_id
      AND arca_environment = p_environment
      AND afip_punto_venta = v_attempt.punto_venta
      AND afip_comprobante_tipo = p_comprobante_tipo
      AND afip_comprobante_numero = p_comprobante_numero
      AND afip_cae IS NOT NULL;

    IF FOUND THEN
        IF v_existing_invoice.afip_cae = p_cae THEN
            -- Validar correspondencia exacta de relaciones en la factura existente
            IF v_existing_invoice.company_id <> p_company_id 
               OR v_existing_invoice.budget_id <> p_budget_id 
               OR v_existing_invoice.client_id <> p_client_id 
               OR v_existing_invoice.arca_environment <> p_environment THEN
                RAISE EXCEPTION 'Inconsistencia en el comprobante fiscal existente % contra los parámetros solicitados.', v_existing_invoice.id;
            END IF;

            IF p_is_corrective THEN
                IF v_existing_invoice.invoice_original_id IS DISTINCT FROM p_invoice_original_id THEN
                    RAISE EXCEPTION 'Inconsistencia en la factura original asociada al comprobante fiscal existente.';
                END IF;
            ELSE
                IF v_existing_invoice.invoice_original_id IS NOT NULL THEN
                    RAISE EXCEPTION 'El comprobante existente posee invoice_original_id pero la operación actual es una factura original.';
                END IF;
            END IF;

            UPDATE public.arca_invoice_attempts
            SET status = 'persisted', 
                cae = p_cae, 
                cae_expires_at = p_cae_expires_at,
                comprobante_numero = p_comprobante_numero, 
                updated_at = NOW()
            WHERE id = p_attempt_id;

            GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
            IF v_updated_rows <> 1 THEN
                RAISE EXCEPTION 'Error al actualizar el intento en resolución idempotente (filas afectadas: %).', v_updated_rows;
            END IF;

            RETURN jsonb_build_object(
                'success', true,
                'cae', p_cae,
                'comprobante_numero', p_comprobante_numero,
                'punto_venta', v_attempt.punto_venta,
                'environment', p_environment,
                'status', 'persisted',
                'idempotent', true
            );
        ELSE
            RAISE EXCEPTION 'Ya existe un comprobante registrado con el número % y punto de venta % pero con CAE diferente.', p_comprobante_numero, v_attempt.punto_venta;
        END IF;
    END IF;

    -- 7. Validaciones y persistencia para comprobantes correctivos (NC / ND)
    IF p_is_corrective THEN
        IF p_invoice_original_id IS NULL THEN
            RAISE EXCEPTION 'invoice_original_id es estrictamente obligatorio para comprobantes correctivos.';
        END IF;

        -- Bloquear la factura original
        SELECT * INTO v_original_invoice
        FROM public.invoices
        WHERE id = p_invoice_original_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'La factura original a corregir (%) no existe.', p_invoice_original_id;
        END IF;

        IF v_original_invoice.company_id <> p_company_id THEN
            RAISE EXCEPTION 'La factura original pertenece a otra empresa.';
        END IF;

        IF v_original_invoice.budget_id <> p_budget_id THEN
            RAISE EXCEPTION 'La factura original no corresponde al presupuesto especificado.';
        END IF;

        IF v_original_invoice.client_id <> p_client_id THEN
            RAISE EXCEPTION 'La factura original pertenece a otro cliente.';
        END IF;

        IF v_original_invoice.arca_environment IS NULL OR v_original_invoice.arca_environment <> p_environment THEN
            RAISE EXCEPTION 'La factura original fue emitida en % y la corrección debe realizarse en ese mismo entorno.', v_original_invoice.arca_environment;
        END IF;

        IF v_original_invoice.status <> 'emitted' THEN
            RAISE EXCEPTION 'La factura original no se encuentra en estado emitida (status actual: %).', v_original_invoice.status;
        END IF;

        IF v_original_invoice.afip_cae IS NULL OR v_original_invoice.afip_comprobante_numero IS NULL OR v_original_invoice.afip_punto_venta IS NULL THEN
            RAISE EXCEPTION 'La factura original no cuenta con datos fiscales completos.';
        END IF;

        IF v_original_invoice.afip_comprobante_tipo NOT IN (1, 6, 11) THEN
            RAISE EXCEPTION 'Solo pueden emitirse notas de crédito o débito sobre facturas originales (tipo 1, 6 u 11).';
        END IF;

        -- Validaciones de saldo acreditable para Nota de Crédito
        IF p_is_credit_note THEN
            SELECT COALESCE(SUM(ABS(total_amount)), 0) INTO v_total_credited
            FROM public.invoices
            WHERE invoice_original_id = p_invoice_original_id
              AND afip_comprobante_tipo IN (3, 8, 13)
              AND status = 'emitted';

            v_remaining_balance := ABS(v_original_invoice.total_amount) - v_total_credited;

            IF v_remaining_balance <= 0 THEN
                RAISE EXCEPTION 'La factura original % ya no posee saldo disponible para acreditar.', p_invoice_original_id;
            END IF;

            IF p_is_total_cancellation THEN
                IF ABS(p_total_amount - v_remaining_balance) > 0.01 THEN
                    RAISE EXCEPTION 'Para anulación total, el importe ($%) debe coincidir exactamente con el saldo restante ($%).', p_total_amount, v_remaining_balance;
                END IF;

                -- Cancelar la factura original con todos los filtros de integridad
                UPDATE public.invoices
                SET 
                    status = 'cancelled',
                    updated_at = NOW()
                WHERE id = p_invoice_original_id
                  AND company_id = p_company_id
                  AND budget_id = p_budget_id
                  AND client_id = p_client_id
                  AND status = 'emitted';

                GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
                IF v_updated_rows <> 1 THEN
                    RAISE EXCEPTION 'Error al cancelar la factura original %: se afectaron % filas (se esperaba 1).', p_invoice_original_id, v_updated_rows;
                END IF;
            ELSE
                IF p_total_amount > v_remaining_balance + 0.01 THEN
                    RAISE EXCEPTION 'El importe de la Nota de Crédito ($%) supera el saldo disponible ($%).', p_total_amount, v_remaining_balance;
                END IF;
            END IF;
        END IF;

        -- Insertar el comprobante correctivo (NC / ND) vinculando invoice_original_id
        INSERT INTO public.invoices (
            company_id,
            client_id,
            budget_id,
            invoice_original_id,
            status,
            total_amount,
            afip_cae,
            afip_cae_vencimiento,
            afip_comprobante_numero,
            afip_comprobante_tipo,
            afip_punto_venta,
            arca_environment,
            invoice_date,
            invoice_number,
            afip_servicio_desde,
            afip_servicio_hasta,
            afip_servicio_vto,
            created_at,
            updated_at
        ) VALUES (
            p_company_id,
            p_client_id,
            p_budget_id,
            p_invoice_original_id,
            'emitted',
            CASE WHEN p_is_credit_note THEN -ABS(p_total_amount) ELSE ABS(p_total_amount) END,
            p_cae,
            p_cae_expires_at,
            p_comprobante_numero,
            p_comprobante_tipo,
            v_attempt.punto_venta,
            p_environment,
            p_invoice_date::DATE,
            p_comprobante_numero,
            p_servicio_desde,
            p_servicio_hasta,
            p_servicio_vto,
            NOW(),
            NOW()
        );
    ELSE
        -- 8. Factura Original: Actualizar budget
        UPDATE public.budgets
        SET 
            afip_cae = p_cae,
            afip_cae_vencimiento = p_cae_expires_at,
            afip_comprobante_numero = p_comprobante_numero,
            afip_comprobante_tipo = p_comprobante_tipo,
            afip_punto_venta = v_attempt.punto_venta,
            arca_environment = p_environment,
            status = 'issued',
            updated_at = NOW()
        WHERE id = p_budget_id;

        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
        IF v_updated_rows = 0 THEN
            RAISE EXCEPTION 'No se pudo actualizar el estado del presupuesto %.', p_budget_id;
        END IF;

        -- Buscar si ya existe un borrador de factura (status='draft')
        SELECT id INTO v_target_invoice_id
        FROM public.invoices
        WHERE budget_id = p_budget_id 
          AND company_id = p_company_id
          AND status = 'draft'
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_target_invoice_id IS NOT NULL THEN
            UPDATE public.invoices
            SET
                status = 'emitted',
                total_amount = p_total_amount,
                afip_cae = p_cae,
                afip_cae_vencimiento = p_cae_expires_at,
                afip_comprobante_numero = p_comprobante_numero,
                afip_comprobante_tipo = p_comprobante_tipo,
                afip_punto_venta = v_attempt.punto_venta,
                arca_environment = p_environment,
                invoice_date = p_invoice_date::DATE,
                invoice_number = p_comprobante_numero,
                afip_servicio_desde = p_servicio_desde,
                afip_servicio_hasta = p_servicio_hasta,
                afip_servicio_vto = p_servicio_vto,
                updated_at = NOW()
            WHERE id = v_target_invoice_id
              AND company_id = p_company_id
              AND budget_id = p_budget_id
              AND status = 'draft';

            GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
            IF v_updated_rows <> 1 THEN
                RAISE EXCEPTION 'Error al actualizar el borrador de factura % (filas afectadas: %).', v_target_invoice_id, v_updated_rows;
            END IF;
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
                afip_punto_venta,
                arca_environment,
                invoice_date,
                invoice_number,
                afip_servicio_desde,
                afip_servicio_hasta,
                afip_servicio_vto,
                created_at,
                updated_at
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
                v_attempt.punto_venta,
                p_environment,
                p_invoice_date::DATE,
                p_comprobante_numero,
                p_servicio_desde,
                p_servicio_hasta,
                p_servicio_vto,
                NOW(),
                NOW()
            );
        END IF;
    END IF;

    -- 9. Actualizar intento a persisted dentro de la misma transacción
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
        'cae', p_cae,
        'comprobante_numero', p_comprobante_numero,
        'punto_venta', v_attempt.punto_venta,
        'environment', p_environment,
        'status', 'persisted'
    );
END;
$$;

-- 6. SEGURIDAD: REVOCAR PERMISOS Y ASIGNAR EXCLUSIVAMENTE A SERVICE_ROLE
REVOKE ALL ON FUNCTION public.persist_arca_invoice_atomic(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, NUMERIC, TEXT, DATE, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_arca_invoice_atomic(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, NUMERIC, TEXT, DATE, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.persist_arca_invoice_atomic(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, NUMERIC, TEXT, DATE, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.persist_arca_invoice_atomic(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, NUMERIC, TEXT, DATE, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

COMMIT;
