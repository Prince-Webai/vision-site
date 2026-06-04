import { createClient } from './client';
import type { Job, Client, Timesheet } from '../types';

export const jobService = {
  /**
   * Fetch a single job with client + items + checklist
   */
  async fetchJob(jobId: string) {
    const supabase = createClient();
    const { data: job, error: jErr } = await supabase
      .from('jobs')
      .select('*, client:clients(*)')
      .eq('id', jobId)
      .single();
    if (jErr) throw jErr;
    const [{ data: items }, { data: checklist }] = await Promise.all([
      supabase.from('job_items').select('*').eq('job_id', jobId).order('created_at'),
      supabase.from('job_checklist').select('*').eq('job_id', jobId).order('sort_order'),
    ]);
    return { ...(job as any), items: items || [], checklist: checklist || [] };
  },

  /**
   * Delete a job (cascades to items, checklist, attachments, timesheets)
   */
  async deleteJob(jobId: string) {
    const supabase = createClient();
    const { error } = await supabase.from('jobs').delete().eq('id', jobId);
    if (error) throw error;
  },

  /**
   * Save (replace) line items for a job
   */
  async saveJobItems(jobId: string, items: { item_code?: string; description: string; quantity: number; unit_price: number; tax_percent: number }[]) {
    const supabase = createClient();
    await supabase.from('job_items').delete().eq('job_id', jobId);
    if (items.length === 0) return;
    const { error } = await supabase
      .from('job_items')
      .insert(items.map(i => ({ ...i, job_id: jobId })));
    if (error) throw error;
  },


  /**
   * Fetch all jobs with their associated client data
   */
  async fetchJobs() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        client:clients(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching jobs:', error?.message || error);
      throw error;
    }

    return data as Job[];
  },

  /**
   * Fetch unscheduled jobs
   */
  async fetchUnscheduledJobs() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        client:clients(*)
      `)
      .is('scheduled_date', null)
      .not('status', 'in', '("Completed", "Cancelled", "Archived")')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching unscheduled jobs:', error?.message || error);
      throw error;
    }

    return data as Job[];
  },

  /**
   * Update a job's status or other fields
   */
  async updateJob(jobId: string, updates: Partial<Job>) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      console.error('Error updating job:', error?.message || error);
      throw error;
    }

    fetch(`/api/jobs/${jobId}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'Job Updated', details: 'Fields updated' }),
    }).catch(() => {});

    return data as Job;
  },

  /**
   * Create a new job
   */
  async createJob(job: Omit<Job, 'id' | 'created_at' | 'updated_at' | 'job_number'>) {
    const supabase = createClient();

    // Generate next sequential job_number (fallback for DBs without the trigger)
    const { data: latest } = await supabase
      .from('jobs')
      .select('job_number')
      .like('job_number', 'VS-%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let next = 1201;
    if (latest?.job_number) {
      const m = latest.job_number.match(/VS-(\d+)/);
      if (m) next = parseInt(m[1], 10) + 1;
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert({ ...(job as any), job_number: `VS-${next}` })
      .select()
      .single();
    if (data) {
      // Log creation via server (service-role bypasses RLS)
      fetch(`/api/jobs/${data.id}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'Job Created', details: `Created ${data.job_number} at ${data.address}` }),
      }).catch(() => {});
    }

    if (error) {
      console.error('Error creating job:', error?.message || error);
      throw error;
    }

    return data as Job;
  },

  /**
   * Save checklist items for a job
   */
  async saveChecklist(jobId: string, items: { text: string; completed: boolean }[]) {
    const supabase = createClient();
    
    // First, delete existing items to replace them (simplest way for now)
    await supabase.from('job_checklist').delete().eq('job_id', jobId);
    
    if (items.length === 0) return;

    const itemsToInsert = items.map((item, index) => ({
      job_id: jobId,
      text: item.text,
      completed: item.completed,
      sort_order: index
    }));

    const { error } = await supabase
      .from('job_checklist')
      .insert(itemsToInsert);

    if (error) {
      console.error('Error saving checklist:', error?.message || error);
      throw error;
    }
  },

  /**
   * Create a new client
   */
  async createClient(client: Omit<Client, 'id' | 'created_at'>) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('clients')
      .insert(client)
      .select()
      .single();

    if (error) {
      console.error('Error creating client:', error?.message || error);
      throw error;
    }

    return data as Client;
  },

  /**
   * Fetch all staff locations
   */
  async fetchStaffLocations() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('staff_locations')
      .select(`
        *,
        profile:profiles(*)
      `);

    if (error) {
      console.error('Error fetching staff locations:', error?.message || error);
      throw error;
    }

    return data;
  },

  /**
   * Fetch all profiles (staff)
   */
  async fetchProfiles() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new profile (used by Invite Staff).
   * Retries without optional columns if the schema cache rejects them.
   */
  async createProfile(p: { email: string; full_name: string; role: string; hourly_rate?: number }) {
    const supabase = createClient();
    const payload: any = { id: crypto.randomUUID(), ...p };

    const tryInsert = async (body: any) =>
      supabase.from('profiles').insert(body).select().single();

    let { data, error } = await tryInsert(payload);
    if (error && /hourly_rate/i.test(error.message)) {
      const { hourly_rate, ...rest } = payload;
      ({ data, error } = await tryInsert(rest));
    }
    if (error) throw error;
    return data;
  },

  /**
   * Delete a profile
   */
  async deleteProfile(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Fetch all clients
   */
  async fetchClients() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('last_name', { ascending: true });

    if (error) {
      console.error('Error fetching clients:', error?.message || error);
      throw error;
    }

    return data as Client[];
  }
};

function withTotals(t: any): Timesheet {
  if (!t) return t;
  const duration = t.ended_at
    ? (new Date(t.ended_at).getTime() - new Date(t.started_at).getTime()) / 60000
    : null;
  const cost = duration != null ? (duration / 60) * (t.hourly_rate || 0) : null;
  return { ...t, duration_minutes: duration, labor_cost: cost };
}

export const timesheetService = {
  async clockIn(jobId: string) {
    const res = await fetch('/api/timesheets/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Clock in failed');
    return data as Timesheet;
  },

  async clockOut() {
    const res = await fetch('/api/timesheets/clock', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Clock out failed');
    return data as Timesheet | null;
  },

  async fetchOpenForUser() {
    const supabase = createClient();
    // No auth in dev — pick the first profile as "current user"
    const { data: prof } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
    if (!prof) return null;
    const { data, error } = await supabase
      .from('timesheets')
      .select('*, profile:profiles(*)')
      .eq('profile_id', prof.id)
      .is('ended_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? withTotals(data) : null;
  },

  async fetchForJob(jobId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('timesheets')
      .select('*, profile:profiles(*)')
      .eq('job_id', jobId)
      .order('started_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(withTotals);
  },

  async fetchAll(opts?: { from?: string; to?: string }) {
    const supabase = createClient();
    let query = supabase
      .from('timesheets')
      .select('*, profile:profiles(*), job:jobs(id, job_number, address)')
      .order('started_at', { ascending: false });
    if (opts?.from) query = query.gte('started_at', opts.from);
    if (opts?.to) query = query.lte('started_at', opts.to);
    const { data, error } = await query.limit(500);
    if (error) throw error;
    return (data || []).map(withTotals) as any;
  },

  async updateEntry(id: string, updates: Partial<Pick<Timesheet, 'started_at' | 'ended_at' | 'hourly_rate' | 'notes'>>) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('timesheets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Timesheet;
  },

  async deleteEntry(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('timesheets').delete().eq('id', id);
    if (error) throw error;
  },
};
