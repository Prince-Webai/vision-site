import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchJobWithItems, renderQuoteHtml } from '@/lib/job-document';
import { sendEmail } from '@/lib/integrations/email';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const job = await fetchJobWithItems(supabase, id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const to = body.to || job.client?.email || job.contact_email;
  if (!to) return NextResponse.json({ error: 'No recipient email on file' }, { status: 400 });

  const html = renderQuoteHtml(job);
  const result = await sendEmail({
    to,
    subject: `Quote ${job.job_number} from VisionSolar`,
    html,
  });

  if (!result.ok) return NextResponse.json(result, { status: 502 });

  return NextResponse.json({ ...result, sentTo: to });
}
