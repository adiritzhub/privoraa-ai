-- Step 8H: deny review of a request by its owner.
-- The request owner and reviewer are both derived from trusted rows/session
-- identity. This additive migration changes no data or table structure.

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

REVOKE ALL ON FUNCTION public.record_approval_decision(uuid, public.approval_decision, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_approval_decision(uuid, public.approval_decision, text) TO authenticated;

COMMENT ON FUNCTION public.record_approval_decision(uuid, public.approval_decision, text) IS
  'Founder-only RPC. Derives reviewer from auth.uid(), rejects request-owner review, and only reviews pending restricted requests.';