-- Phase 9: align the deterministic classifier volatility with PostgreSQL's
-- volatility analysis for jsonb_build_object.

ALTER FUNCTION public.classify_generation_policy(text) STABLE;
