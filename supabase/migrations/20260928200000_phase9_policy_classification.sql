-- Phase 9: trusted policy classification for generation requests.
-- This is a deterministic development baseline, not a production moderation model.
-- Replace or augment public.classify_generation_policy before public launch.

ALTER TABLE public.generation_requests
  DROP CONSTRAINT IF EXISTS generation_requests_classification_state_check;

ALTER TABLE public.generation_requests
  ADD CONSTRAINT generation_requests_classification_state_check CHECK (
    (classification IS NULL AND request_state IN ('pending', 'pending_classification', 'blocked', 'failed'))
    OR (classification = 'normal' AND request_state IN ('processing', 'completed', 'blocked', 'failed'))
    OR (classification = 'allowed' AND request_state IN ('eligible', 'processing', 'completed', 'blocked', 'failed'))
    OR (classification = 'restricted' AND request_state IN (
      'pending', 'pending_approval', 'approved', 'rejected', 'blocked', 'processing', 'completed', 'failed'
    ))
    OR (classification = 'prohibited' AND request_state = 'blocked')
  );

CREATE OR REPLACE FUNCTION public.classify_generation_policy(p_prompt text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $function$
DECLARE
  v_prompt text := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_prompt, '')));
BEGIN
  IF v_prompt = '' THEN
    RAISE EXCEPTION 'Prompt is required';
  END IF;

  -- Deterministic development rules only. These rules are deliberately small
  -- and must not be represented as a complete safety or moderation system.
  IF v_prompt ~ '(^|[^a-z])(prohibited|illegal|sexual exploitation|graphic violence)([^a-z]|$)' THEN
    RETURN pg_catalog.jsonb_build_object(
      'classification', 'prohibited',
      'reason_code', 'POLICY_PROHIBITED'
    );
  END IF;

  IF v_prompt ~ '(^|[^a-z])(restricted|weapon|medical advice|real person)([^a-z]|$)' THEN
    RETURN pg_catalog.jsonb_build_object(
      'classification', 'restricted',
      'reason_code', 'POLICY_RESTRICTED'
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'classification', 'allowed',
    'reason_code', 'POLICY_ALLOWED'
  );
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
        (NEW.classification IN ('normal', 'allowed') AND NEW.request_state IN ('eligible', 'processing'))
        OR (NEW.classification = 'restricted' AND NEW.request_state IN ('pending', 'pending_approval'))
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
        OR (OLD.classification = 'allowed' AND OLD.request_state = 'eligible'
          AND NEW.request_state IN ('processing', 'blocked', 'failed'))
        OR (OLD.classification IN ('normal', 'allowed') AND OLD.request_state = 'processing'
          AND NEW.request_state IN ('completed', 'blocked', 'failed'))
        OR (OLD.classification = 'restricted' AND OLD.request_state IN ('pending', 'pending_approval')
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
      AND request.request_state IN (
        'pending'::public.generation_request_state,
        'pending_approval'::public.generation_request_state
      )
  ) THEN
    RAISE EXCEPTION 'Only pending restricted requests may receive a decision';
  END IF;

  RETURN NEW;
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
  v_request_id uuid;
  v_policy_result jsonb;
  v_classification public.generation_classification;
  v_request_state public.generation_request_state;
  v_policy_version text := 'local-deterministic-v1';
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
  WHERE usage.usage_count < v_daily_limit;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily generation limit reached' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    v_policy_result := public.classify_generation_policy(p_prompt);
    v_classification := (v_policy_result ->> 'classification')::public.generation_classification;
    v_request_state := CASE v_classification
      WHEN 'allowed'::public.generation_classification THEN 'eligible'::public.generation_request_state
      WHEN 'restricted'::public.generation_classification THEN 'pending_approval'::public.generation_request_state
      WHEN 'prohibited'::public.generation_classification THEN 'blocked'::public.generation_request_state
    END;
  EXCEPTION WHEN OTHERS THEN
    v_policy_result := pg_catalog.jsonb_build_object('reason_code', 'POLICY_UNAVAILABLE');
    v_classification := NULL;
    v_request_state := 'failed'::public.generation_request_state;
  END;

  INSERT INTO public.generation_requests (
    user_id, prompt, category_id, category, classification, policy_result, policy_version, request_state
  ) VALUES (
    v_user_id, p_prompt, p_category_id, v_category, v_classification, v_policy_result, v_policy_version, v_request_state
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Generation request not found' USING ERRCODE = '42501';
  END IF;
  IF v_request.user_id = v_actor_id THEN
    RAISE EXCEPTION 'Request owners cannot review their own request' USING ERRCODE = '42501';
  END IF;
  IF v_request.classification <> 'restricted'::public.generation_classification
    OR v_request.request_state NOT IN (
      'pending'::public.generation_request_state,
      'pending_approval'::public.generation_request_state
    ) THEN
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

REVOKE ALL ON FUNCTION public.classify_generation_policy(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_generation_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_generation_request(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.record_approval_decision(uuid, public.approval_decision, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_approval_decision(uuid, public.approval_decision, text) TO authenticated;

COMMENT ON FUNCTION public.classify_generation_policy(text) IS
  'Deterministic development policy baseline. Not a production moderation model; callable only by trusted database functions.';
COMMENT ON FUNCTION public.submit_generation_request(uuid, text) IS
  'Authenticated RPC. Atomically validates identity, permission, settings, category, quota, and trusted policy classification; clients cannot supply classification or state.';
COMMENT ON FUNCTION public.record_approval_decision(uuid, public.approval_decision, text) IS
  'Founder-only RPC. Derives reviewer from auth.uid(), rejects request-owner review, and only reviews pending restricted requests.';
