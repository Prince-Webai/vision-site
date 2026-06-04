import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchJobWithItems } from '@/lib/job-document';
import { createPaymentLink } from '@/lib/integrations/stripe';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const job = await fetchJobWithItems(supabase, id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const total = (job.items || []).reduce(
    (s, i) => s + i.quantity * i.unit_price * (1 + i.tax_percent / 100),
    0
  );
  if (total <= 0) return NextResponse.json({ error: 'Invoice has zero value' }, { status: 400 });

  const result = await createPaymentLink({
    jobNumber: job.job_number,
    amountCents: Math.round(total * 100),
    currency: 'eur',
    customerEmail: job.client?.email || job.contact_email || undefined,
    description: `Invoice ${job.job_number}`,
  });

  return NextResponse.json(result);
}
