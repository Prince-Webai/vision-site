import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUserName } from '@/lib/supabase/current-user';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      action: body.action || 'Update',
      entity_type: 'job',
      entity_id: id,
      user_name: body.user_name || await currentUserName(),
      details: body.details || '',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
