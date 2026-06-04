import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUserName } from '@/lib/supabase/current-user';

const BUCKET = 'job-attachments';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File over 10MB' }, { status: 413 });
  }

  const supabase = createAdminClient();

  // Upload to storage
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${jobId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Record in job_attachments
  const { data: row, error: dbErr } = await supabase
    .from('job_attachments')
    .insert({
      job_id: jobId,
      file_name: file.name,
      file_type: file.type,
      file_url: pub.publicUrl,
      file_size: file.size,
    })
    .select()
    .single();
  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  // Log activity
  await supabase.from('audit_logs').insert({
    action: 'File attached',
    entity_type: 'job',
    entity_id: jobId,
    user_name: await currentUserName(),
    details: file.name,
  });

  return NextResponse.json(row);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('job_attachments')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const url = new URL(req.url);
  const attachmentId = url.searchParams.get('attachmentId');
  if (!attachmentId) return NextResponse.json({ error: 'attachmentId required' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from('job_attachments')
    .select('file_url')
    .eq('id', attachmentId)
    .single();

  if (row?.file_url) {
    // Extract path from public URL
    const match = row.file_url.match(/\/object\/public\/[^/]+\/(.+)$/);
    if (match) await supabase.storage.from(BUCKET).remove([match[1]]);
  }

  const { error } = await supabase.from('job_attachments').delete().eq('id', attachmentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
