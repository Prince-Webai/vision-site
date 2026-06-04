import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchJobWithItems } from '@/lib/job-document';
import { sendSms } from '@/lib/integrations/sms';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const job = await fetchJobWithItems(supabase, id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const to = body.to || job.client?.mobile || job.client?.phone || job.contact_phone;
  if (!to) return NextResponse.json({ error: 'No recipient mobile on file' }, { status: 400 });

  const origin = req.nextUrl.origin;
  const total = (job.items || []).reduce(
    (s, i) => s + i.quantity * i.unit_price * (1 + i.tax_percent / 100),
    0
  );
  const link = `${origin}/print/quote/${id}`;
  const msg = body.body || `VisionSolar quote ${job.job_number}: $${total.toFixed(2)}. View: ${link}`;

  const result = await sendSms({ to, body: msg });
  if (!result.ok) return NextResponse.json(result, { status: 502 });

  return NextResponse.json({ ...result, sentTo: to });
}
