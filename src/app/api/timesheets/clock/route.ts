import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Clock in: closes any open timesheet for this user, opens a new one for the job.
export async function POST(req: NextRequest) {
  const { jobId, profileId } = await req.json().catch(() => ({}));
  const supabase = createAdminClient();

  // Resolve profile — explicit profileId wins, else use first available profile.
  let userId = profileId;
  if (!userId) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .order('created_at')
      .limit(1)
      .maybeSingle();
    userId = data?.id;
  }
  if (!userId) return NextResponse.json({ error: 'No profile available' }, { status: 400 });
  if (!jobId)  return NextResponse.json({ error: 'jobId required' }, { status: 400 });

  // Close any open entry for this user
  await supabase
    .from('timesheets')
    .update({ ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('profile_id', userId)
    .is('ended_at', null);

  // Look up hourly rate
  const { data: prof } = await supabase
    .from('profiles')
    .select('hourly_rate')
    .eq('id', userId)
    .maybeSingle();
  const rate = (prof as any)?.hourly_rate ?? 0;

  // Open new entry
  const { data, error } = await supabase
    .from('timesheets')
    .insert({
      job_id: jobId,
      profile_id: userId,
      started_at: new Date().toISOString(),
      hourly_rate: rate,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Clock out: closes any open entry for the user.
export async function DELETE(req: NextRequest) {
  const { profileId } = await req.json().catch(() => ({}));
  const supabase = createAdminClient();

  let userId = profileId;
  if (!userId) {
    const { data } = await supabase.from('profiles').select('id').order('created_at').limit(1).maybeSingle();
    userId = data?.id;
  }
  if (!userId) return NextResponse.json({ error: 'No profile available' }, { status: 400 });

  const { data, error } = await supabase
    .from('timesheets')
    .update({ ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('profile_id', userId)
    .is('ended_at', null)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
