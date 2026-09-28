-- Phase 9: add policy classification and lifecycle values.
-- Kept separate from the functions that consume these values because
-- PostgreSQL may not allow a newly added enum value to be used in the same
-- transaction that adds it.

ALTER TYPE public.generation_classification ADD VALUE IF NOT EXISTS 'allowed' AFTER 'normal';
ALTER TYPE public.generation_request_state ADD VALUE IF NOT EXISTS 'pending_classification' AFTER 'pending';
ALTER TYPE public.generation_request_state ADD VALUE IF NOT EXISTS 'pending_approval' AFTER 'pending_classification';
ALTER TYPE public.generation_request_state ADD VALUE IF NOT EXISTS 'eligible' AFTER 'approved';