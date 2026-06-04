-- DEV ONLY — opens all tables to the anon role so the app works without login.
-- DO NOT apply this in production. Re-tighten by dropping these policies.

-- Helper: drop+create "anon all" policy on a table
-- (we keep existing auth-based policies; this just ADDS an anon escape hatch)

DROP POLICY IF EXISTS "dev anon all" ON public.profiles;
CREATE POLICY "dev anon all" ON public.profiles FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev anon all" ON public.clients;
CREATE POLICY "dev anon all" ON public.clients FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev anon all" ON public.jobs;
CREATE POLICY "dev anon all" ON public.jobs FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev anon all" ON public.job_items;
CREATE POLICY "dev anon all" ON public.job_items FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev anon all" ON public.job_checklist;
CREATE POLICY "dev anon all" ON public.job_checklist FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev anon all" ON public.job_attachments;
CREATE POLICY "dev anon all" ON public.job_attachments FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev anon all" ON public.staff_locations;
CREATE POLICY "dev anon all" ON public.staff_locations FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev anon all" ON public.audit_logs;
CREATE POLICY "dev anon all" ON public.audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- Timesheets (table may not exist yet — guard with DO block)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'timesheets') THEN
    EXECUTE 'DROP POLICY IF EXISTS "dev anon all" ON public.timesheets';
    EXECUTE 'CREATE POLICY "dev anon all" ON public.timesheets FOR ALL TO anon USING (true) WITH CHECK (true)';
  END IF;
END $$;
