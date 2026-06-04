import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fetchJobWithItems,
  renderQuoteHtml,
  renderInvoiceHtml,
  renderWorkOrderHtml,
} from '@/lib/job-document';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  const supabase = await createClient();
  const job = await fetchJobWithItems(supabase, id);
  if (!job) return new NextResponse('Job not found', { status: 404 });

  let html: string;
  if (type === 'quote') html = renderQuoteHtml(job);
  else if (type === 'invoice') html = renderInvoiceHtml(job);
  else if (type === 'work-order') html = renderWorkOrderHtml(job);
  else return new NextResponse('Unknown document type', { status: 400 });

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
