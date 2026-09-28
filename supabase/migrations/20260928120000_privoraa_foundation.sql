-- Privoraa AI core schema and RLS foundation.
-- Apply once through the Supabase migration ledger. This migration assumes the
-- standard Supabase auth schema and database roles are present.

DO $types$
BEGIN
  BEGIN
    CREATE TYPE public.app_role AS ENUM ('user', 'founder');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  IF COALESCE((
    SELECT pg_catalog.array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    FROM pg_catalog.pg_enum AS e
    WHERE e.enumtypid = 'public.app_role'::pg_catalog.regtype
  ), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['user', 'founder']::text[] THEN
    RAISE EXCEPTION 'Existing public.app_role enum does not match Privoraa values';
  END IF;

  BEGIN
    CREATE TYPE public.permission_state AS ENUM ('normal', 'restricted', 'suspended');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  IF COALESCE((
    SELECT pg_catalog.array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    FROM pg_catalog.pg_enum AS e
    WHERE e.enumtypid = 'public.permission_state'::pg_catalog.regtype
  ), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['normal', 'restricted', 'suspended']::text[] THEN
    RAISE EXCEPTION 'Existing public.permission_state enum does not match Privoraa values';
  END IF;

  BEGIN
    CREATE TYPE public.generation_classification AS ENUM ('normal', 'restricted', 'prohibited');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  IF COALESCE((
    SELECT pg_catalog.array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    FROM pg_catalog.pg_enum AS e
    WHERE e.enumtypid = 'public.generation_classification'::pg_catalog.regtype
  ), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['normal', 'restricted', 'prohibited']::text[] THEN
    RAISE EXCEPTION 'Existing public.generation_classification enum does not match Privoraa values';
  END IF;

  BEGIN
    CREATE TYPE public.generation_request_state AS ENUM (
      'pending', 'approved', 'rejected', 'blocked', 'processing', 'completed', 'failed'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  IF COALESCE((
    SELECT pg_catalog.array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    FROM pg_catalog.pg_enum AS e
    WHERE e.enumtypid = 'public.generation_request_state'::pg_catalog.regtype
  ), ARRAY[]::text[]) IS DISTINCT FROM ARRAY[
    'pending', 'approved', 'rejected', 'blocked', 'processing', 'completed', 'failed'
  ]::text[] THEN
    RAISE EXCEPTION 'Existing public.generation_request_state enum does not match Privoraa values';
  END IF;

  BEGIN
    CREATE TYPE public.approval_decision AS ENUM ('approved', 'rejected');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  IF COALESCE((
    SELECT pg_catalog.array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    FROM pg_catalog.pg_enum AS e
    WHERE e.enumtypid = 'public.approval_decision'::pg_catalog.regtype
  ), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['approved', 'rejected']::text[] THEN
    RAISE EXCEPTION 'Existing public.approval_decision enum does not match Privoraa values';
  END IF;
END
$types$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  permission_state public.permission_state NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  name text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT categories_name_length CHECK (
    pg_catalog.length(pg_catalog.btrim(name)) BETWEEN 1 AND 120
  ),
  CONSTRAINT categories_configuration_object CHECK (
    pg_catalog.jsonb_typeof(configuration) = 'object'
  )
);

CREATE TABLE public.app_settings (
  singleton_id boolean PRIMARY KEY DEFAULT true,
  global_generation_enabled boolean NOT NULL DEFAULT false,
  daily_generation_limit integer NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT app_settings_singleton_only CHECK (singleton_id IS TRUE),
  CONSTRAINT app_settings_daily_limit CHECK (daily_generation_limit BETWEEN 1 AND 10000)
);

CREATE TABLE public.generation_requests (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  prompt text NOT NULL,
  category_id uuid REFERENCES public.categories (id) ON DELETE SET NULL,
  category text NOT NULL,
  classification public.generation_classification,
  policy_result jsonb,
  policy_version text,
  request_state public.generation_request_state NOT NULL DEFAULT 'pending',
  generation_provider text,
  generation_model text,
  provider_request_id text,
  generation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT generation_requests_prompt_check CHECK (
    pg_catalog.length(pg_catalog.btrim(prompt)) BETWEEN 1 AND 6000
  ),
  CONSTRAINT generation_requests_category_check CHECK (
    pg_catalog.length(pg_catalog.btrim(category)) BETWEEN 1 AND 120
  ),
  CONSTRAINT generation_requests_policy_result_object CHECK (
    policy_result IS NULL OR pg_catalog.jsonb_typeof(policy_result) = 'object'
  ),
  CONSTRAINT generation_requests_metadata_object CHECK (
    pg_catalog.jsonb_typeof(generation_metadata) = 'object'
  ),
  CONSTRAINT generation_requests_policy_version_check CHECK (
    policy_version IS NULL OR pg_catalog.length(pg_catalog.btrim(policy_version)) BETWEEN 1 AND 120
  ),
  CONSTRAINT generation_requests_classification_has_result CHECK (
    classification IS NULL OR (policy_result IS NOT NULL AND policy_version IS NOT NULL)
  ),
  CONSTRAINT generation_requests_classification_state_check CHECK (
    (classification IS NULL AND request_state IN ('pending', 'blocked', 'failed'))
    OR (classification = 'normal' AND request_state IN ('processing', 'completed', 'blocked', 'failed'))
    OR (classification = 'restricted' AND request_state IN (
      'pending', 'approved', 'rejected', 'blocked', 'processing', 'completed', 'failed'
    ))
    OR (classification = 'prohibited' AND request_state = 'blocked')
  )
);

CREATE TABLE public.approval_decisions (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.generation_requests (id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  decision public.approval_decision NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT approval_decisions_reason_length CHECK (
    reason IS NULL OR pg_catalog.length(reason) <= 2000
  )
);

CREATE TABLE public.user_daily_usage (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, usage_date),
  CONSTRAINT user_daily_usage_count_check CHECK (usage_count >= 0)
);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT activity_logs_action_length CHECK (
    pg_catalog.length(pg_catalog.btrim(action)) BETWEEN 1 AND 120
  ),
  CONSTRAINT activity_logs_target_type_length CHECK (
    pg_catalog.length(pg_catalog.btrim(target_type)) BETWEEN 1 AND 80
  ),
  CONSTRAINT activity_logs_metadata_object CHECK (
    pg_catalog.jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX profiles_role_idx ON public.profiles (role);
CREATE INDEX profiles_permission_state_idx ON public.profiles (permission_state);
CREATE INDEX categories_enabled_idx ON public.categories (enabled);
CREATE INDEX generation_requests_user_id_idx ON public.generation_requests (user_id);
CREATE INDEX generation_requests_request_state_idx ON public.generation_requests (request_state);
CREATE INDEX generation_requests_classification_idx ON public.generation_requests (classification);
CREATE INDEX generation_requests_created_at_idx ON public.generation_requests (created_at DESC);
CREATE INDEX approval_decisions_reviewer_id_idx ON public.approval_decisions (reviewer_id);
CREATE INDEX user_daily_usage_usage_date_idx ON public.user_daily_usage (usage_date DESC);
CREATE INDEX activity_logs_actor_id_idx ON public.activity_logs (actor_id);
CREATE INDEX activity_logs_created_at_idx ON public.activity_logs (created_at DESC);

COMMENT ON TABLE public.profiles IS
  'Trusted application role and permission state; public signup metadata is never used for either field.';
COMMENT ON TABLE public.generation_requests IS
  'Prompt requests; classification is null until a trusted policy service records a result.';
COMMENT ON TABLE public.approval_decisions IS
  'Append-only founder decisions for restricted requests; direct client writes are denied.';
COMMENT ON TABLE public.user_daily_usage IS
  'Atomic per-user UTC-day request quota counters; clients cannot mutate counts.';
COMMENT ON TABLE public.activity_logs IS
  'Append-oriented audit metadata. Do not store prompts, credentials, or provider secrets here.';

INSERT INTO public.app_settings (singleton_id, global_generation_enabled, daily_generation_limit)
VALUES (true, false, 20)
ON CONFLICT (singleton_id) DO NOTHING;

INSERT INTO public.categories (name)
VALUES
  ('Learning illustration'),
  ('Historical scene'),
  ('Product study')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_current_founder()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
      AND profile.role = 'founder'::public.app_role
      AND profile.permission_state = 'normal'::public.permission_state
  );
$function$;

COMMENT ON FUNCTION public.is_current_founder() IS
  'Trusted, non-recursive RLS helper. Identity comes from auth.uid(); founder accounts must be normal.';

CREATE OR REPLACE FUNCTION public.create_profile_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  INSERT INTO public.profiles (id, role, permission_state)
  VALUES (NEW.id, 'user'::public.app_role, 'normal'::public.permission_state)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_generation_request_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.prompt IS DISTINCT FROM OLD.prompt
    OR NEW.category_id IS DISTINCT FROM OLD.category_id
    OR NEW.category IS DISTINCT FROM OLD.category THEN
    RAISE EXCEPTION 'Generation request ownership and submitted content are immutable';
  END IF;

  IF OLD.classification IS NULL THEN
    IF NEW.classification IS NULL THEN
      IF NEW.request_state IS DISTINCT FROM OLD.request_state
        AND NEW.request_state NOT IN ('blocked', 'failed') THEN
        RAISE EXCEPTION 'Unclassified requests may only fail closed';
      END IF;
    ELSE
      IF NOT (
        (NEW.classification = 'normal' AND NEW.request_state = 'processing')
        OR (NEW.classification = 'restricted' AND NEW.request_state = 'pending')
        OR (NEW.classification = 'prohibited' AND NEW.request_state = 'blocked')
      ) THEN
        RAISE EXCEPTION 'Classification does not permit this initial request state';
      END IF;
    END IF;
  ELSE
    IF NEW.classification IS DISTINCT FROM OLD.classification
      OR NEW.policy_result IS DISTINCT FROM OLD.policy_result
      OR NEW.policy_version IS DISTINCT FROM OLD.policy_version THEN
      RAISE EXCEPTION 'Recorded policy classification is immutable';
    END IF;

    IF NEW.request_state IS DISTINCT FROM OLD.request_state THEN
      IF NOT (
        (OLD.classification = 'normal' AND OLD.request_state = 'processing'
          AND NEW.request_state IN ('completed', 'blocked', 'failed'))
        OR (OLD.classification = 'restricted' AND OLD.request_state = 'pending'
          AND NEW.request_state IN ('approved', 'rejected', 'blocked'))
        OR (OLD.classification = 'restricted' AND OLD.request_state = 'approved'
          AND NEW.request_state IN ('processing', 'blocked'))
        OR (OLD.classification = 'restricted' AND OLD.request_state = 'processing'
          AND NEW.request_state IN ('completed', 'blocked', 'failed'))
      ) THEN
        RAISE EXCEPTION 'Invalid generation request state transition';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_approval_decision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = NEW.reviewer_id
      AND profile.role = 'founder'::public.app_role
      AND profile.permission_state = 'normal'::public.permission_state
  ) THEN
    RAISE EXCEPTION 'Approval reviewer must be an active Founder';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.generation_requests AS request
    WHERE request.id = NEW.request_id
      AND request.classification = 'restricted'::public.generation_classification
      AND request.request_state = 'pending'::public.generation_request_state
  ) THEN
    RAISE EXCEPTION 'Only pending restricted requests may receive a decision';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_generation_request(
  p_category_id uuid,
  p_prompt text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_permission_state public.permission_state;
  v_category text;
  v_generation_enabled boolean;
  v_daily_limit integer;
  v_usage_date date := pg_catalog.timezone('UTC', pg_catalog.now())::date;
  v_usage_count integer;
  v_request_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_prompt IS NULL OR pg_catalog.length(pg_catalog.btrim(p_prompt)) NOT BETWEEN 1 AND 6000 THEN
    RAISE EXCEPTION 'Prompt must contain between 1 and 6000 characters';
  END IF;

  SELECT profile.permission_state
  INTO v_permission_state
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id;

  IF NOT FOUND OR v_permission_state = 'suspended'::public.permission_state THEN
    RAISE EXCEPTION 'Account is not allowed to submit generation requests' USING ERRCODE = '42501';
  END IF;

  SELECT category.name
  INTO v_category
  FROM public.categories AS category
  WHERE category.id = p_category_id
    AND category.enabled IS TRUE
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category is unavailable' USING ERRCODE = '42501';
  END IF;

  SELECT settings.global_generation_enabled, settings.daily_generation_limit
  INTO v_generation_enabled, v_daily_limit
  FROM public.app_settings AS settings
  WHERE settings.singleton_id IS TRUE
  FOR SHARE;

  IF NOT FOUND OR v_generation_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Generation is disabled' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_daily_usage AS usage (user_id, usage_date, usage_count)
  VALUES (v_user_id, v_usage_date, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    usage_count = usage.usage_count + 1,
    updated_at = pg_catalog.now()
  WHERE usage.usage_count < v_daily_limit
  RETURNING usage.usage_count INTO v_usage_count;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily generation limit reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.generation_requests (
    user_id, prompt, category_id, category, classification, policy_result, policy_version, request_state
  ) VALUES (
    v_user_id, p_prompt, p_category_id, v_category, NULL, NULL, NULL, 'pending'
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.activity_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_user_id,
    'generation.request_submitted',
    'generation_request',
    v_request_id,
    pg_catalog.jsonb_build_object('category_id', p_category_id)
  );

  RETURN v_request_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_approval_decision(
  p_request_id uuid,
  p_decision public.approval_decision,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_request public.generation_requests%ROWTYPE;
  v_decision_id uuid;
  v_next_state public.generation_request_state;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_current_founder() THEN
    RAISE EXCEPTION 'Active Founder authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NOT NULL AND pg_catalog.length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'Decision reason exceeds 2000 characters';
  END IF;

  SELECT * INTO v_request
  FROM public.generation_requests AS request
  WHERE request.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_request.classification <> 'restricted'::public.generation_classification
    OR v_request.request_state <> 'pending'::public.generation_request_state THEN
    RAISE EXCEPTION 'Only pending restricted requests can be reviewed' USING ERRCODE = '42501';
  END IF;

  v_next_state := CASE p_decision
    WHEN 'approved'::public.approval_decision THEN 'approved'::public.generation_request_state
    WHEN 'rejected'::public.approval_decision THEN 'rejected'::public.generation_request_state
  END;

  INSERT INTO public.approval_decisions (request_id, reviewer_id, decision, reason)
  VALUES (p_request_id, v_actor_id, p_decision, NULLIF(pg_catalog.btrim(p_reason), ''))
  RETURNING id INTO v_decision_id;

  UPDATE public.generation_requests
  SET request_state = v_next_state
  WHERE id = p_request_id;

  INSERT INTO public.activity_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_actor_id,
    'generation.approval_decided',
    'generation_request',
    p_request_id,
    pg_catalog.jsonb_build_object('decision', p_decision, 'approval_decision_id', v_decision_id)
  );

  RETURN v_decision_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_profile_access(
  p_target_user_id uuid,
  p_role public.app_role,
  p_permission_state public.permission_state
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_old_role public.app_role;
  v_old_state public.permission_state;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_current_founder() THEN
    RAISE EXCEPTION 'Active Founder authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_target_user_id IS NULL OR p_target_user_id = v_actor_id THEN
    RAISE EXCEPTION 'Founder cannot change their own access through this operation' USING ERRCODE = '42501';
  END IF;

  SELECT profile.role, profile.permission_state
  INTO v_old_role, v_old_state
  FROM public.profiles AS profile
  WHERE profile.id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile not found';
  END IF;

  UPDATE public.profiles
  SET role = p_role, permission_state = p_permission_state
  WHERE id = p_target_user_id;

  INSERT INTO public.activity_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_actor_id,
    'profile.access_updated',
    'profile',
    p_target_user_id,
    pg_catalog.jsonb_build_object(
      'old_role', v_old_role,
      'new_role', p_role,
      'old_permission_state', v_old_state,
      'new_permission_state', p_permission_state
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_global_generation_settings(
  p_enabled boolean,
  p_daily_limit integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_current_founder() THEN
    RAISE EXCEPTION 'Active Founder authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_daily_limit NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Daily generation limit must be between 1 and 10000';
  END IF;

  UPDATE public.app_settings
  SET global_generation_enabled = p_enabled,
      daily_generation_limit = p_daily_limit,
      updated_by = v_actor_id
  WHERE singleton_id IS TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Global settings row is missing';
  END IF;

  INSERT INTO public.activity_logs (actor_id, action, target_type, metadata)
  VALUES (
    v_actor_id,
    'settings.generation_updated',
    'app_settings',
    pg_catalog.jsonb_build_object(
      'global_generation_enabled', p_enabled,
      'daily_generation_limit', p_daily_limit
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_category_controls(
  p_category_id uuid,
  p_enabled boolean,
  p_configuration jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_current_founder() THEN
    RAISE EXCEPTION 'Active Founder authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_configuration IS NULL OR pg_catalog.jsonb_typeof(p_configuration) <> 'object' THEN
    RAISE EXCEPTION 'Category configuration must be a JSON object';
  END IF;

  UPDATE public.categories
  SET enabled = p_enabled, configuration = p_configuration
  WHERE id = p_category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  INSERT INTO public.activity_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_actor_id,
    'category.configuration_updated',
    'category',
    p_category_id,
    pg_catalog.jsonb_build_object('enabled', p_enabled)
  );
END;
$function$;

DROP TRIGGER IF EXISTS privoraa_create_profile_after_auth_signup ON auth.users;
CREATE TRIGGER privoraa_create_profile_after_auth_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_auth_user();

DROP TRIGGER IF EXISTS privoraa_profiles_updated_at ON public.profiles;
CREATE TRIGGER privoraa_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS privoraa_categories_updated_at ON public.categories;
CREATE TRIGGER privoraa_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS privoraa_settings_updated_at ON public.app_settings;
CREATE TRIGGER privoraa_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS privoraa_generation_requests_updated_at ON public.generation_requests;
CREATE TRIGGER privoraa_generation_requests_updated_at
BEFORE UPDATE ON public.generation_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS privoraa_generation_requests_state_guard ON public.generation_requests;
CREATE TRIGGER privoraa_generation_requests_state_guard
BEFORE UPDATE ON public.generation_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_generation_request_update();

DROP TRIGGER IF EXISTS privoraa_user_daily_usage_updated_at ON public.user_daily_usage;
CREATE TRIGGER privoraa_user_daily_usage_updated_at
BEFORE UPDATE ON public.user_daily_usage
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS privoraa_approval_decisions_validate ON public.approval_decisions;
CREATE TRIGGER privoraa_approval_decisions_validate
BEFORE INSERT ON public.approval_decisions
FOR EACH ROW EXECUTE FUNCTION public.validate_approval_decision();

DROP TRIGGER IF EXISTS privoraa_approval_decisions_append_only ON public.approval_decisions;
CREATE TRIGGER privoraa_approval_decisions_append_only
BEFORE UPDATE OR DELETE ON public.approval_decisions
FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();

DROP TRIGGER IF EXISTS privoraa_activity_logs_append_only ON public.activity_logs;
CREATE TRIGGER privoraa_activity_logs_append_only
BEFORE UPDATE OR DELETE ON public.activity_logs
FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.generation_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_usage FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_read_self_or_active_founder ON public.profiles;
CREATE POLICY profiles_read_self_or_active_founder
ON public.profiles FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR (SELECT public.is_current_founder()));

DROP POLICY IF EXISTS categories_read_enabled_or_founder ON public.categories;
CREATE POLICY categories_read_enabled_or_founder
ON public.categories FOR SELECT TO authenticated
USING (enabled IS TRUE OR (SELECT public.is_current_founder()));

DROP POLICY IF EXISTS app_settings_read_authenticated ON public.app_settings;
CREATE POLICY app_settings_read_authenticated
ON public.app_settings FOR SELECT TO authenticated
USING (singleton_id IS TRUE);

DROP POLICY IF EXISTS generation_requests_read_owner_or_founder ON public.generation_requests;
CREATE POLICY generation_requests_read_owner_or_founder
ON public.generation_requests FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_current_founder()));

DROP POLICY IF EXISTS approval_decisions_read_active_founder ON public.approval_decisions;
CREATE POLICY approval_decisions_read_active_founder
ON public.approval_decisions FOR SELECT TO authenticated
USING ((SELECT public.is_current_founder()));

DROP POLICY IF EXISTS user_daily_usage_read_owner_or_founder ON public.user_daily_usage;
CREATE POLICY user_daily_usage_read_owner_or_founder
ON public.user_daily_usage FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_current_founder()));

DROP POLICY IF EXISTS activity_logs_read_active_founder ON public.activity_logs;
CREATE POLICY activity_logs_read_active_founder
ON public.activity_logs FOR SELECT TO authenticated
USING ((SELECT public.is_current_founder()));

REVOKE ALL ON TABLE
  public.profiles,
  public.categories,
  public.app_settings,
  public.generation_requests,
  public.approval_decisions,
  public.user_daily_usage,
  public.activity_logs
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.profiles,
  public.categories,
  public.app_settings,
  public.generation_requests,
  public.approval_decisions,
  public.user_daily_usage,
  public.activity_logs
TO authenticated;

GRANT ALL ON TABLE
  public.profiles,
  public.categories,
  public.app_settings,
  public.generation_requests,
  public.approval_decisions,
  public.user_daily_usage,
  public.activity_logs
TO service_role;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_profile_for_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_generation_request_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_approval_decision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_append_only_mutation() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_current_founder() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_founder() TO authenticated;

REVOKE ALL ON FUNCTION public.submit_generation_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_generation_request(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.record_approval_decision(uuid, public.approval_decision, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_approval_decision(uuid, public.approval_decision, text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_profile_access(uuid, public.app_role, public.permission_state) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_profile_access(uuid, public.app_role, public.permission_state) TO authenticated;

REVOKE ALL ON FUNCTION public.set_global_generation_settings(boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_global_generation_settings(boolean, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.set_category_controls(uuid, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_category_controls(uuid, boolean, jsonb) TO authenticated;

COMMENT ON FUNCTION public.submit_generation_request(uuid, text) IS
  'Authenticated RPC. Derives user_id from auth.uid(), rejects suspended users, checks global enablement/category/quota atomically, and creates an unclassified pending request only.';
COMMENT ON FUNCTION public.record_approval_decision(uuid, public.approval_decision, text) IS
  'Founder-only RPC. Derives reviewer from auth.uid() and only reviews pending restricted requests.';
COMMENT ON FUNCTION public.set_profile_access(uuid, public.app_role, public.permission_state) IS
  'Founder-only RPC. Cannot modify the acting Founder; direct profile mutation is denied.';
COMMENT ON FUNCTION public.set_global_generation_settings(boolean, integer) IS
  'Founder-only RPC for singleton generation settings; direct client mutation is denied.';
COMMENT ON FUNCTION public.set_category_controls(uuid, boolean, jsonb) IS
  'Founder-only RPC for category configuration; direct client mutation is denied.';

GRANT USAGE ON SCHEMA public TO authenticated;

-- Initial Founder promotion must be performed by a trusted operator against a
-- real auth.users-backed profile. This migration deliberately creates no Founder.