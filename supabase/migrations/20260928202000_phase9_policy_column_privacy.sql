-- Phase 9: keep policy provider metadata out of browser-readable columns.
-- UI services only need the request lifecycle and safe classification.

REVOKE SELECT ON TABLE public.generation_requests FROM authenticated;
GRANT SELECT (
  id,
  user_id,
  prompt,
  category,
  classification,
  request_state,
  created_at,
  updated_at
) ON TABLE public.generation_requests TO authenticated;
