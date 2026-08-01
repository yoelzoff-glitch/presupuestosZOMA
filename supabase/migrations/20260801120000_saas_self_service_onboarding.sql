-- ZOMA ERP - Self-service SaaS onboarding and recurring billing.
-- This migration is intentionally additive and does not backfill existing rows.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS mp_preapproval_id text,
  ADD COLUMN IF NOT EXISTS mp_payer_id text,
  ADD COLUMN IF NOT EXISTS mp_external_reference text,
  ADD COLUMN IF NOT EXISTS mp_init_point text,
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_status text,
  ADD COLUMN IF NOT EXISTS billing_next_charge_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_last_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_grace_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_cancel_at_period_end boolean,
  ADD COLUMN IF NOT EXISTS billing_version bigint,
  ADD COLUMN IF NOT EXISTS tenant_provisioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS companies_mp_preapproval_id_uidx
  ON public.companies (mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS companies_billing_status_idx
  ON public.companies (billing_status)
  WHERE billing_status IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id),
  company_id uuid REFERENCES public.companies(id),
  email text NOT NULL,
  full_name text NOT NULL,
  company_name text NOT NULL,
  company_cuit text,
  company_phone text,
  business_type text NOT NULL DEFAULT 'products'
    CHECK (business_type IN ('products', 'services')),
  plan_type text NOT NULL DEFAULT 'base'
    CHECK (plan_type IN ('base', 'pro')),
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending_checkout'
    CHECK (status IN (
      'pending_checkout',
      'pending_authorization',
      'authorized',
      'provisioning',
      'provisioned',
      'provisioning_failed',
      'cancelled'
    )),
  mp_preapproval_id text,
  mp_payer_id text,
  mp_external_reference text,
  mp_init_point text,
  mp_status text,
  plan_amount numeric NOT NULL CHECK (plan_amount > 0),
  currency_id text NOT NULL DEFAULT 'ARS',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  next_payment_at timestamptz,
  provisioning_attempts integer NOT NULL DEFAULT 0,
  last_error_code text,
  last_error_message text,
  request_ip_hash text,
  request_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS onboarding_sessions_idempotency_uidx
  ON public.onboarding_sessions (idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS onboarding_sessions_auth_user_uidx
  ON public.onboarding_sessions (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS onboarding_sessions_preapproval_uidx
  ON public.onboarding_sessions (mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS onboarding_sessions_status_created_idx
  ON public.onboarding_sessions (status, created_at);

CREATE TABLE IF NOT EXISTS public.saas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  mp_event_id text,
  event_type text NOT NULL,
  event_action text,
  resource_id text NOT NULL,
  request_id text,
  live_mode boolean,
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
  processing_attempts integer NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text
);

CREATE INDEX IF NOT EXISTS saas_webhook_events_processing_idx
  ON public.saas_webhook_events (processing_status, received_at);

CREATE TABLE IF NOT EXISTS public.saas_billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  onboarding_session_id uuid REFERENCES public.onboarding_sessions(id),
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  previous_status text,
  new_status text,
  mp_preapproval_id text,
  mp_payment_id text,
  payment_status text,
  status_detail text,
  amount numeric,
  currency_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saas_billing_events_company_created_idx
  ON public.saas_billing_events (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  entity_type text NOT NULL CHECK (entity_type IN ('products', 'clients')),
  file_name text,
  file_hash text,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'completed_with_errors', 'failed')),
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS import_jobs_company_created_idx
  ON public.import_jobs (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.import_job_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id),
  row_number integer NOT NULL,
  field_name text,
  error_code text NOT NULL,
  message text NOT NULL,
  raw_row jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_job_errors_job_idx
  ON public.import_job_errors (import_job_id, row_number);

CREATE TABLE IF NOT EXISTS public.imported_row_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id),
  row_key text NOT NULL,
  created_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_job_id, row_key)
);

CREATE TABLE IF NOT EXISTS public.saas_rate_limits (
  rate_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imported_row_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'onboarding_sessions'
      AND policyname = 'Users read their onboarding session'
  ) THEN
    CREATE POLICY "Users read their onboarding session"
      ON public.onboarding_sessions
      FOR SELECT
      USING (auth.uid() = auth_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saas_billing_events'
      AND policyname = 'Company admins read SaaS billing events'
  ) THEN
    CREATE POLICY "Company admins read SaaS billing events"
      ON public.saas_billing_events
      FOR SELECT
      USING (public.is_member_of(company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'import_jobs'
      AND policyname = 'Company members read import jobs'
  ) THEN
    CREATE POLICY "Company members read import jobs"
      ON public.import_jobs
      FOR SELECT
      USING (public.is_member_of(company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'import_job_errors'
      AND policyname = 'Company members read import errors'
  ) THEN
    CREATE POLICY "Company members read import errors"
      ON public.import_job_errors
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.import_jobs job
          WHERE job.id = import_job_id
            AND public.is_member_of(job.company_id)
        )
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_saas_rate_limit(
  p_rate_key text,
  p_max_hits integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hits integer;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  IF p_max_hits < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid_rate_limit_configuration';
  END IF;

  INSERT INTO public.saas_rate_limits (
    rate_key,
    window_started_at,
    hits,
    updated_at
  )
  VALUES (p_rate_key, now(), 1, now())
  ON CONFLICT (rate_key) DO UPDATE
  SET window_started_at = CASE
        WHEN public.saas_rate_limits.window_started_at
          + make_interval(secs => p_window_seconds) <= now()
          THEN now()
        ELSE public.saas_rate_limits.window_started_at
      END,
      hits = CASE
        WHEN public.saas_rate_limits.window_started_at
          + make_interval(secs => p_window_seconds) <= now()
          THEN 1
        ELSE public.saas_rate_limits.hits + 1
      END,
      updated_at = now()
  RETURNING hits INTO v_hits;

  RETURN v_hits <= p_max_hits;
END;
$$;

CREATE OR REPLACE FUNCTION public.provision_trial_tenant(
  p_onboarding_session_id uuid,
  p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.onboarding_sessions%ROWTYPE;
  v_existing_company_id uuid;
  v_company_id uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  BEGIN
    SELECT *
  INTO v_session
  FROM public.onboarding_sessions
  WHERE id = p_onboarding_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'onboarding_session_not_found';
  END IF;

  IF v_session.auth_user_id IS DISTINCT FROM p_auth_user_id THEN
    RAISE EXCEPTION 'onboarding_user_mismatch';
  END IF;

  IF v_session.company_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'company_id', v_session.company_id,
      'created', false,
      'status', 'provisioned'
    );
  END IF;

  IF v_session.mp_status IS DISTINCT FROM 'authorized' THEN
    RAISE EXCEPTION 'subscription_not_authorized';
  END IF;

  SELECT company_id
  INTO v_existing_company_id
  FROM public.users_profiles
  WHERE id = p_auth_user_id
  FOR UPDATE;

  IF v_existing_company_id IS NOT NULL THEN
    RAISE EXCEPTION 'user_already_has_company';
  END IF;

  UPDATE public.onboarding_sessions
  SET status = 'provisioning',
      provisioning_attempts = provisioning_attempts + 1,
      last_error_code = NULL,
      last_error_message = NULL,
      updated_at = now()
  WHERE id = p_onboarding_session_id;

  INSERT INTO public.companies (
    name,
    cuit,
    phone,
    email,
    plan_type,
    business_type,
    enable_stock_module,
    subscription_status,
    subscription_expiry,
    mp_preapproval_id,
    mp_payer_id,
    mp_external_reference,
    mp_init_point,
    trial_started_at,
    trial_ends_at,
    billing_status,
    billing_next_charge_at,
    billing_cancel_at_period_end,
    billing_version,
    tenant_provisioned_at
  )
  VALUES (
    v_session.company_name,
    v_session.company_cuit,
    v_session.company_phone,
    v_session.email,
    v_session.plan_type,
    v_session.business_type,
    v_session.plan_type = 'pro',
    'trial',
    v_session.trial_ends_at,
    v_session.mp_preapproval_id,
    v_session.mp_payer_id,
    v_session.mp_external_reference,
    v_session.mp_init_point,
    v_session.trial_started_at,
    v_session.trial_ends_at,
    'trial',
    v_session.next_payment_at,
    false,
    1,
    now()
  )
  RETURNING id INTO v_company_id;

  IF EXISTS (
    SELECT 1 FROM public.users_profiles WHERE id = p_auth_user_id
  ) THEN
    UPDATE public.users_profiles
    SET company_id = v_company_id,
        full_name = v_session.full_name,
        role = 'admin'
    WHERE id = p_auth_user_id
      AND company_id IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'existing_profile_could_not_be_linked';
    END IF;
  ELSE
    INSERT INTO public.users_profiles (
      id,
      company_id,
      full_name,
      role
    )
    VALUES (
      p_auth_user_id,
      v_company_id,
      v_session.full_name,
      'admin'
    );
  END IF;

  INSERT INTO public.saas_billing_events (
    company_id,
    onboarding_session_id,
    event_key,
    event_type,
    previous_status,
    new_status,
    mp_preapproval_id,
    payment_status,
    occurred_at,
    payload
  )
  VALUES (
    v_company_id,
    v_session.id,
    'tenant-provisioned:' || v_session.id::text,
    'tenant_provisioned',
    'provisioning',
    'trial',
    v_session.mp_preapproval_id,
    v_session.mp_status,
    now(),
    jsonb_build_object(
      'plan_type', v_session.plan_type,
      'trial_ends_at', v_session.trial_ends_at
    )
  )
  ON CONFLICT (event_key) DO NOTHING;

  UPDATE public.onboarding_sessions
  SET company_id = v_company_id,
      status = 'provisioned',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_onboarding_session_id;

  RETURN jsonb_build_object(
    'company_id', v_company_id,
    'created', true,
    'status', 'provisioned'
  );
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.onboarding_sessions
    SET status = 'provisioning_failed',
        last_error_code = SQLSTATE,
        last_error_message = SQLERRM,
        updated_at = now()
    WHERE id = p_onboarding_session_id
      AND company_id IS NULL;
    RETURN jsonb_build_object(
      'company_id', NULL,
      'created', false,
      'status', 'provisioning_failed',
      'error_code', SQLSTATE,
      'error_message', SQLERRM
    );
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_saas_billing_event(
  p_company_id uuid,
  p_event_key text,
  p_event_type text,
  p_new_status text,
  p_mp_preapproval_id text,
  p_mp_payment_id text,
  p_payment_status text,
  p_status_detail text,
  p_amount numeric,
  p_currency_id text,
  p_next_charge_at timestamptz,
  p_occurred_at timestamptz,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_previous_status text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  IF p_new_status NOT IN ('trial', 'active', 'past_due', 'cancelled', 'suspended') THEN
    RAISE EXCEPTION 'invalid_billing_status';
  END IF;


  SELECT billing_status
  INTO v_previous_status
  FROM public.companies
  WHERE id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'company_not_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.saas_billing_events WHERE event_key = p_event_key
  ) THEN
    RETURN jsonb_build_object('processed', false, 'duplicate', true);
  END IF;

  INSERT INTO public.saas_billing_events (
    company_id,
    event_key,
    event_type,
    previous_status,
    new_status,
    mp_preapproval_id,
    mp_payment_id,
    payment_status,
    status_detail,
    amount,
    currency_id,
    occurred_at,
    payload
  )
  VALUES (
    p_company_id,
    p_event_key,
    p_event_type,
    v_previous_status,
    p_new_status,
    p_mp_preapproval_id,
    p_mp_payment_id,
    p_payment_status,
    p_status_detail,
    p_amount,
    p_currency_id,
    COALESCE(p_occurred_at, now()),
    COALESCE(p_payload, '{}'::jsonb)
  );

  UPDATE public.companies
  SET billing_status = p_new_status,
      subscription_status = p_new_status,
      mp_preapproval_id = COALESCE(p_mp_preapproval_id, mp_preapproval_id),
      billing_next_charge_at = COALESCE(p_next_charge_at, billing_next_charge_at),
      billing_last_payment_at = CASE
        WHEN p_payment_status = 'approved' THEN COALESCE(p_occurred_at, now())
        ELSE billing_last_payment_at
      END,
      billing_failed_at = CASE
        WHEN p_new_status = 'past_due' THEN COALESCE(p_occurred_at, now())
        WHEN p_new_status = 'active' THEN NULL
        ELSE billing_failed_at
      END,
      billing_cancel_at_period_end = CASE
        WHEN p_new_status = 'cancelled'
          OR p_event_type = 'subscription_cancelled_at_period_end' THEN true
        WHEN p_new_status = 'active' THEN false
        ELSE billing_cancel_at_period_end
      END,
      subscription_expiry = CASE
        WHEN p_new_status = 'active' AND p_next_charge_at IS NOT NULL
          THEN p_next_charge_at
        WHEN p_new_status = 'past_due'
          THEN COALESCE(p_occurred_at, now())
        ELSE subscription_expiry
      END,
      billing_version = COALESCE(billing_version, 0) + 1
  WHERE id = p_company_id;

  RETURN jsonb_build_object(
    'processed', true,
    'duplicate', false,
    'previous_status', v_previous_status,
    'new_status', p_new_status
  );
END;
$$;
