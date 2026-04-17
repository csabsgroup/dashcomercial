-- =============================================
-- Add missing is_configured column to piperun_config
-- =============================================
ALTER TABLE public.piperun_config ADD COLUMN IF NOT EXISTS is_configured BOOLEAN DEFAULT false;

-- =============================================
-- Fix RLS: allow all authenticated users to SELECT piperun_config
-- (needed for Dashboard, Ranking, Goals to read pipeline IDs and field_mappings)
-- =============================================

-- Drop the redundant admin-only SELECT policy (the FOR ALL policy already covers admin SELECT)
DROP POLICY IF EXISTS "Admins can read piperun config" ON public.piperun_config;

-- Add a SELECT policy for all authenticated users
CREATE POLICY "All authenticated read piperun config"
  ON public.piperun_config FOR SELECT
  USING (auth.role() = 'authenticated');
