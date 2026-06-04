import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUserName } from '@/lib/supabase/current-user';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', 'job')
    .eq('entity_id', id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text = (body.note || '').toString().trim();
  if (!text) return NextResponse.json({ error: 'note required' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      action: 'Note',
      entity_type: 'job',
      entity_id: id,
      user_name: body.user_name || await currentUserName(),
      details: text,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
