-- VisionSolar — Timesheets
-- Adds time tracking per technician per job, plus an hourly_rate column on profiles
-- for labor-cost rollups. Includes an RPC for safe "clock in" that closes any open
-- entry for the same user first.

-- ===========================
-- PROFILES: hourly rate
-- ===========================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2) DEFAULT 0;

-- ===========================
-- TIMESHEETS
-- ===========================
CREATE TABLE IF NOT EXISTS public.timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  hourly_rate NUMERIC(8,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Helpful generated view of duration & cost
CREATE OR REPLACE VIEW public.timesheets_with_totals AS
SELECT
  t.*,
  CASE
    WHEN t.ended_at IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (t.ended_at - t.started_at)) / 60.0
  END AS duration_minutes,
  CASE
    WHEN t.ended_at IS NULL THEN NULL
    ELSE (EXTRACT(EPOCH FROM (t.ended_at - t.started_at)) / 3600.0) * COALESCE(t.hourly_rate, 0)
  END AS labor_cost
FROM public.timesheets t;

CREATE INDEX IF NOT EXISTS idx_timesheets_job_id ON public.timesheets(job_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_profile_id ON public.timesheets(profile_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_started_at ON public.timesheets(started_at DESC);
-- Only one open (unclosed) entry per technician at a time
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_timesheet_per_user
  ON public.timesheets(profile_id) WHERE ended_at IS NULL;

-- ===========================
-- RLS
-- ===========================
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Dispatcher full access timesheets" ON public.timesheets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('Admin', 'Dispatcher'))
  );

CREATE POLICY "Technician read own timesheets" ON public.timesheets
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Technician insert own timesheets" ON public.timesheets
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Technician update own timesheets" ON public.timesheets
  FOR UPDATE USING (profile_id = auth.uid());

-- ===========================
-- RPC: clock_in (closes any open entry, opens a new one)
-- ===========================
CREATE OR REPLACE FUNCTION public.clock_in(p_job_id UUID)
RETURNS public.timesheets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
  v_row public.timesheets;
BEGIN
  -- Close any existing open entry for this user (auto clock-out)
  UPDATE public.timesheets
     SET ended_at = now(), updated_at = now()
   WHERE profile_id = auth.uid() AND ended_at IS NULL;

  SELECT COALESCE(hourly_rate, 0) INTO v_rate FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.timesheets (job_id, profile_id, started_at, hourly_rate)
       VALUES (p_job_id, auth.uid(), now(), v_rate)
    RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.clock_out()
RETURNS public.timesheets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.timesheets;
BEGIN
  UPDATE public.timesheets
     SET ended_at = now(), updated_at = now()
   WHERE profile_id = auth.uid() AND ended_at IS NULL
   RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
