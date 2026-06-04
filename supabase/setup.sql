-- ============================================================================
-- VisionSolar — One-shot setup script
-- Paste this whole file into the Supabase SQL editor and click Run.
-- Combines: schema, timesheets, open-RLS-for-dev, seed data.
-- ============================================================================

-- -------------- 1. SCHEMA --------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Dispatcher', 'Technician')),
  avatar_url TEXT,
  hourly_rate NUMERIC(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  suburb TEXT,
  status TEXT NOT NULL DEFAULT 'Quote' CHECK (status IN ('Lead', 'Quote', 'Quote Sent', 'Work Order', 'In Progress', 'Completed', 'Cancelled', 'Unsuccessful', 'Archived')),
  category TEXT CHECK (category IN ('Installation', 'Service', 'Site Assessment')),
  description TEXT,
  po_number TEXT,
  scheduled_date DATE,
  completed_date DATE,
  estimated_hours NUMERIC(5,2),
  system_size TEXT,
  requires_site_visit BOOLEAN DEFAULT false,
  materials_status TEXT DEFAULT 'N/A' CHECK (materials_status IN ('Pending', 'Ordered', 'Received', 'N/A')),
  invoice_status TEXT DEFAULT 'Draft' CHECK (invoice_status IN ('Draft', 'Sent', 'Paid', 'Unpaid', 'Overdue')),
  total_value NUMERIC(12,2),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  billing_same_as_job BOOLEAN DEFAULT true,
  billing_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  item_code TEXT,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 10,
  total NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price * (1 + tax_percent / 100)) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE OR REPLACE VIEW public.timesheets_with_totals AS
SELECT t.*,
  CASE WHEN t.ended_at IS NULL THEN NULL
       ELSE EXTRACT(EPOCH FROM (t.ended_at - t.started_at)) / 60.0 END AS duration_minutes,
  CASE WHEN t.ended_at IS NULL THEN NULL
       ELSE (EXTRACT(EPOCH FROM (t.ended_at - t.started_at)) / 3600.0) * COALESCE(t.hourly_rate, 0) END AS labor_cost
FROM public.timesheets t;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date ON public.jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON public.jobs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON public.job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_checklist_job_id ON public.job_checklist(job_id);
CREATE INDEX IF NOT EXISTS idx_job_attachments_job_id ON public.job_attachments(job_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timesheets_job_id ON public.timesheets(job_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_profile_id ON public.timesheets(profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_timesheet_per_user
  ON public.timesheets(profile_id) WHERE ended_at IS NULL;

-- -------------- 2. JOB NUMBER AUTO-GENERATION --------------
CREATE OR REPLACE FUNCTION public.generate_job_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(job_number FROM 4) AS INTEGER)), 1200) + 1
      INTO next_num
      FROM public.jobs WHERE job_number ~ '^VS-[0-9]+$';
    NEW.job_number := 'VS-' || next_num;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_job_number ON public.jobs;
CREATE TRIGGER set_job_number BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.generate_job_number();

-- -------------- 3. CLOCK IN/OUT RPCs (work even without auth) --------------
CREATE OR REPLACE FUNCTION public.clock_in(p_job_id UUID, p_profile_id UUID DEFAULT NULL)
RETURNS public.timesheets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID;
  v_rate NUMERIC;
  v_row public.timesheets;
BEGIN
  v_user := COALESCE(p_profile_id, auth.uid(), (SELECT id FROM public.profiles ORDER BY created_at LIMIT 1));
  IF v_user IS NULL THEN RAISE EXCEPTION 'No profile available'; END IF;

  UPDATE public.timesheets SET ended_at = now(), updated_at = now()
   WHERE profile_id = v_user AND ended_at IS NULL;

  SELECT COALESCE(hourly_rate, 0) INTO v_rate FROM public.profiles WHERE id = v_user;

  INSERT INTO public.timesheets (job_id, profile_id, started_at, hourly_rate)
       VALUES (p_job_id, v_user, now(), v_rate)
    RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.clock_out(p_profile_id UUID DEFAULT NULL)
RETURNS public.timesheets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID;
  v_row public.timesheets;
BEGIN
  v_user := COALESCE(p_profile_id, auth.uid(), (SELECT id FROM public.profiles ORDER BY created_at LIMIT 1));
  UPDATE public.timesheets SET ended_at = now(), updated_at = now()
   WHERE profile_id = v_user AND ended_at IS NULL
   RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- -------------- 4. RLS — open to anon for dev --------------
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_checklist   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['profiles','clients','jobs','job_items','job_checklist','job_attachments','staff_locations','audit_logs','timesheets']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "anon all" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- -------------- 5. SEED DATA --------------
-- Staff
INSERT INTO public.profiles (id, email, full_name, role, hourly_rate) VALUES
  ('11111111-1111-1111-1111-111111111101', 'rahul@visionsolar.com.au', 'Rahul Mandal', 'Admin', 0),
  ('11111111-1111-1111-1111-111111111102', 'james@visionsolar.com.au', 'James Chen', 'Technician', 85),
  ('11111111-1111-1111-1111-111111111103', 'sarah@visionsolar.com.au', 'Sarah Mitchell', 'Technician', 85),
  ('11111111-1111-1111-1111-111111111104', 'tom@visionsolar.com.au', 'Tom Baker', 'Technician', 80),
  ('11111111-1111-1111-1111-111111111105', 'lisa@visionsolar.com.au', 'Lisa Nguyen', 'Dispatcher', 65)
ON CONFLICT (id) DO NOTHING;

-- Clients
INSERT INTO public.clients (id, first_name, last_name, email, phone, mobile, address) VALUES
  ('22222222-2222-2222-2222-222222222201', 'Michael',  'Thompson',  'michael.t@email.com',  '03 9876 5432', '0412 345 678', '42 Lonsdale St, Melbourne VIC 3000'),
  ('22222222-2222-2222-2222-222222222202', 'Emma',     'Rodriguez', 'emma.r@email.com',     '03 9123 4567', '0423 456 789', '15 Chapel St, South Yarra VIC 3141'),
  ('22222222-2222-2222-2222-222222222203', 'David',    'Wilson',    'david.w@email.com',    '03 9234 5678', '0434 567 890', '88 Bridge Rd, Richmond VIC 3121'),
  ('22222222-2222-2222-2222-222222222204', 'Jennifer', 'Patel',     'jen.patel@email.com',  '03 9345 6789', '0445 678 901', '23 High St, Kew VIC 3101'),
  ('22222222-2222-2222-2222-222222222205', 'Robert',   'Chang',     'r.chang@email.com',    '03 9456 7890', '0456 789 012', '7 Station St, Box Hill VIC 3128'),
  ('22222222-2222-2222-2222-222222222206', 'Kate',     'O''Brien',  'kate.ob@email.com',    '03 9567 8901', '0467 890 123', '56 Main Rd, Eltham VIC 3095')
ON CONFLICT (id) DO NOTHING;

-- Jobs
INSERT INTO public.jobs (id, job_number, client_id, address, suburb, status, category, description, scheduled_date, estimated_hours, system_size, materials_status, invoice_status, total_value, assigned_to, contact_name, contact_email, contact_phone) VALUES
  ('33333333-3333-3333-3333-333333333301','VS-1201','22222222-2222-2222-2222-222222222201','42 Lonsdale St, Melbourne VIC 3000','Melbourne','Work Order','Installation','6.6kW solar panel system installation - 16x Trina Vertex S panels with Fronius Primo inverter', CURRENT_DATE, 6, '6.6kW','Received','Draft',8500,'11111111-1111-1111-1111-111111111102','Michael Thompson','michael.t@email.com','0412 345 678'),
  ('33333333-3333-3333-3333-333333333302','VS-1202','22222222-2222-2222-2222-222222222202','15 Chapel St, South Yarra VIC 3141','South Yarra','Quote Sent','Installation','10kW commercial solar system with battery storage - SolarEdge inverter with Tesla Powerwall', NULL, 8, '10kW','Pending','Draft',18500,NULL,'Emma Rodriguez','emma.r@email.com','0423 456 789'),
  ('33333333-3333-3333-3333-333333333303','VS-1203','22222222-2222-2222-2222-222222222203','88 Bridge Rd, Richmond VIC 3121','Richmond','Lead','Site Assessment','Roof assessment for potential 5kW residential installation', NULL, 2, NULL,'N/A','Draft',NULL,NULL,'David Wilson','david.w@email.com','0434 567 890'),
  ('33333333-3333-3333-3333-333333333304','VS-1204','22222222-2222-2222-2222-222222222204','23 High St, Kew VIC 3101','Kew','Work Order','Installation','8.8kW solar panel system with micro-inverters', CURRENT_DATE, 7, '8.8kW','Received','Draft',12200,'11111111-1111-1111-1111-111111111103','Jennifer Patel','jen.patel@email.com','0445 678 901'),
  ('33333333-3333-3333-3333-333333333305','VS-1205','22222222-2222-2222-2222-222222222205','7 Station St, Box Hill VIC 3128','Box Hill','Quote','Installation','5kW residential solar system - budget-friendly option', NULL, 5, '5kW','Pending','Draft',6200,NULL,'Robert Chang','r.chang@email.com','0456 789 012'),
  ('33333333-3333-3333-3333-333333333306','VS-1206','22222222-2222-2222-2222-222222222206','56 Main Rd, Eltham VIC 3095','Eltham','Completed','Installation','13.2kW solar panel system with 2x Tesla Powerwall batteries', CURRENT_DATE - 1, 10, '13.2kW','Received','Paid',32000,'11111111-1111-1111-1111-111111111102','Kate O''Brien','kate.ob@email.com','0467 890 123'),
  ('33333333-3333-3333-3333-333333333307','VS-1198','22222222-2222-2222-2222-222222222201','42 Lonsdale St, Melbourne VIC 3000','Melbourne','Completed','Service','Annual inverter service and panel cleaning', CURRENT_DATE - 7, 3, '6.6kW','N/A','Paid',450,'11111111-1111-1111-1111-111111111104','Michael Thompson','michael.t@email.com','0412 345 678'),
  ('33333333-3333-3333-3333-333333333308','VS-1199','22222222-2222-2222-2222-222222222203','88 Bridge Rd, Richmond VIC 3121','Richmond','Completed','Service','Emergency inverter fault diagnosis - SolarEdge SE7K', CURRENT_DATE - 5, 4, '7kW','Received','Paid',680,'11111111-1111-1111-1111-111111111103','David Wilson','david.w@email.com','0434 567 890')
ON CONFLICT (id) DO NOTHING;

-- Job items for the Work Order
INSERT INTO public.job_items (job_id, item_code, description, quantity, unit_price, tax_percent) VALUES
  ('33333333-3333-3333-3333-333333333301','PNL-TRINA-410','Trina Vertex S 410W Panel', 16, 185, 10),
  ('33333333-3333-3333-3333-333333333301','INV-FRON-5','Fronius Primo 5.0-1 Inverter', 1, 1850, 10),
  ('33333333-3333-3333-3333-333333333301','INST-STD','Standard Installation Labour', 1, 2800, 10),
  ('33333333-3333-3333-3333-333333333301','MTR-RAIL','Mounting Rails & Hardware Kit', 1, 420, 10)
ON CONFLICT DO NOTHING;

-- Checklist for the Work Order
INSERT INTO public.job_checklist (job_id, text, completed, "order", sort_order) VALUES
  ('33333333-3333-3333-3333-333333333301','Confirm roof measurements and panel layout', true, 1, 1),
  ('33333333-3333-3333-3333-333333333301','Verify electrical connection and grounding', true, 2, 2),
  ('33333333-3333-3333-3333-333333333301','Install mounting rails',                     false, 3, 3),
  ('33333333-3333-3333-3333-333333333301','Mount solar panels',                         false, 4, 4),
  ('33333333-3333-3333-3333-333333333301','Connect inverter and test',                  false, 5, 5),
  ('33333333-3333-3333-3333-333333333301','Final inspection and client walkthrough',    false, 6, 6)
ON CONFLICT DO NOTHING;

-- Staff GPS pins
INSERT INTO public.staff_locations (profile_id, latitude, longitude) VALUES
  ('11111111-1111-1111-1111-111111111102', -37.8136, 144.9631),
  ('11111111-1111-1111-1111-111111111103', -37.8350, 144.9890),
  ('11111111-1111-1111-1111-111111111104', -37.8200, 144.9700)
ON CONFLICT (profile_id) DO NOTHING;

-- Audit log samples
INSERT INTO public.audit_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Rahul Mandal',  'Created job',  'job', '33333333-3333-3333-3333-333333333301', 'Created VS-1201 for Michael Thompson'),
  ('11111111-1111-1111-1111-111111111102', 'James Chen',    'Updated status','job', '33333333-3333-3333-3333-333333333301', 'Changed status to Work Order'),
  ('11111111-1111-1111-1111-111111111101', 'Rahul Mandal',  'Sent quote',    'job', '33333333-3333-3333-3333-333333333302', 'Quote sent to emma.r@email.com')
ON CONFLICT DO NOTHING;

-- -------------- 6. REALTIME --------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
