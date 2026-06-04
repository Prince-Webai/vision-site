// Shared document-rendering helpers used by print pages and email sends.
// Pure functions — given a Job + items, produce branded HTML.

import type { Job, JobItem, Client } from './types';

interface JobWithExtras extends Job {
  items?: JobItem[];
  client?: Client;
}

function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function totalsFor(items: JobItem[] = []) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax = items.reduce((s, i) => s + (i.quantity * i.unit_price * i.tax_percent) / 100, 0);
  return { subtotal, tax, total: subtotal + tax };
}

function header(title: string, job: JobWithExtras) {
  return `
    <header style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #5C8F5A;padding-bottom:16px;margin-bottom:24px">
      <div>
        <div style="font-size:24px;font-weight:700;color:#5C8F5A">VisionSolar</div>
        <div style="font-size:11px;color:#4B5563;margin-top:4px">Solar installations & service</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:22px;font-weight:700;color:#1F2937">${title}</div>
        <div style="font-size:12px;color:#4B5563;margin-top:4px">Job ${job.job_number}</div>
        <div style="font-size:11px;color:#4B5563">${new Date().toLocaleDateString('en-AU')}</div>
      </div>
    </header>`;
}

function partyBlock(job: JobWithExtras) {
  const client = job.client;
  const clientName = client ? `${client.first_name} ${client.last_name}` : (job.contact_name || '—');
  const billing = job.billing_same_as_job ? job.address : (job.billing_address || job.address);
  return `
    <section style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
      <div>
        <div style="font-size:10px;text-transform:uppercase;color:#9CA3AF;letter-spacing:0.05em">Client</div>
        <div style="font-weight:600;color:#1F2937;margin-top:4px">${clientName}</div>
        <div style="font-size:12px;color:#4B5563">${client?.email || job.contact_email || ''}</div>
        <div style="font-size:12px;color:#4B5563">${client?.phone || job.contact_phone || ''}</div>
        <div style="font-size:12px;color:#4B5563;margin-top:8px">${billing || ''}</div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;color:#9CA3AF;letter-spacing:0.05em">Job site</div>
        <div style="font-weight:600;color:#1F2937;margin-top:4px">${job.address || '—'}</div>
        <div style="font-size:12px;color:#4B5563">${job.suburb || ''}</div>
        ${job.po_number ? `<div style="font-size:12px;color:#4B5563;margin-top:8px">PO #${job.po_number}</div>` : ''}
        ${job.scheduled_date ? `<div style="font-size:12px;color:#4B5563">Scheduled ${job.scheduled_date}</div>` : ''}
      </div>
    </section>`;
}

function itemsTable(items: JobItem[] = []) {
  const rows = items.map(i => {
    const lineTotal = i.quantity * i.unit_price * (1 + i.tax_percent / 100);
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:12px">${i.item_code || ''}</td>
      <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:12px">${i.description}</td>
      <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:12px;text-align:center">${i.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:12px;text-align:right">€${fmt(i.unit_price)}</td>
      <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:12px;text-align:center">${i.tax_percent}%</td>
      <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:12px;text-align:right">€${fmt(lineTotal)}</td>
    </tr>`;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead>
        <tr style="background:#F9FAFB">
          <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#9CA3AF">Code</th>
          <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#9CA3AF">Description</th>
          <th style="padding:8px;text-align:center;font-size:10px;text-transform:uppercase;color:#9CA3AF">Qty</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#9CA3AF">Price</th>
          <th style="padding:8px;text-align:center;font-size:10px;text-transform:uppercase;color:#9CA3AF">Tax</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#9CA3AF">Total</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6" style="padding:24px;text-align:center;color:#9CA3AF;font-size:12px">No items</td></tr>`}</tbody>
    </table>`;
}

function totalsBlock(items: JobItem[] = []) {
  const { subtotal, tax, total } = totalsFor(items);
  return `
    <section style="display:flex;justify-content:flex-end;margin-bottom:24px">
      <table style="min-width:240px">
        <tr><td style="padding:4px 12px;font-size:12px;color:#4B5563">Subtotal</td><td style="padding:4px 0;font-size:12px;text-align:right">€${fmt(subtotal)}</td></tr>
        <tr><td style="padding:4px 12px;font-size:12px;color:#4B5563">VAT</td><td style="padding:4px 0;font-size:12px;text-align:right">€${fmt(tax)}</td></tr>
        <tr style="border-top:2px solid #1F2937"><td style="padding:8px 12px;font-weight:700;color:#1F2937">Total</td><td style="padding:8px 0;font-weight:700;text-align:right;color:#1F2937;font-size:16px">€${fmt(total)}</td></tr>
      </table>
    </section>`;
}

function shell(title: string, body: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1F2937;max-width:800px;margin:32px auto;padding:24px;background:white}
  @media print {body{margin:0;padding:0}}
  .actions{display:flex;gap:8px;margin-bottom:16px}
  .actions button{background:#5C8F5A;color:white;border:0;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px}
  .actions button.secondary{background:white;color:#4B5563;border:1px solid #E5E7EB}
  @media print {.actions{display:none}}
</style></head><body>
<div class="actions">
  <button onclick="window.print()">Print</button>
  <button class="secondary" onclick="window.close()">Close</button>
</div>
${body}
</body></html>`;
}

export function renderQuoteHtml(job: JobWithExtras) {
  return shell(
    `Quote ${job.job_number}`,
    header('QUOTE', job) +
      partyBlock(job) +
      (job.description ? `<section style="margin-bottom:16px;padding:12px;background:#F9FAFB;border-radius:6px;font-size:13px;color:#4B5563">${job.description}</section>` : '') +
      itemsTable(job.items) +
      totalsBlock(job.items) +
      `<footer style="border-top:1px solid #E5E7EB;padding-top:16px;font-size:11px;color:#9CA3AF">This quote is valid for 30 days. Prices include VAT where applicable.</footer>`
  );
}

export function renderInvoiceHtml(job: JobWithExtras, opts?: { paymentUrl?: string }) {
  const payBlock = opts?.paymentUrl
    ? `<section style="margin-bottom:24px;padding:16px;background:#F0FDF4;border:1px solid #5C8F5A;border-radius:6px">
         <div style="font-weight:600;color:#1F2937;margin-bottom:4px">Pay online</div>
         <a href="${opts.paymentUrl}" style="color:#5C8F5A;font-size:13px;word-break:break-all">${opts.paymentUrl}</a>
       </section>`
    : '';
  return shell(
    `Invoice ${job.job_number}`,
    header('INVOICE', job) +
      partyBlock(job) +
      itemsTable(job.items) +
      totalsBlock(job.items) +
      payBlock +
      `<footer style="border-top:1px solid #E5E7EB;padding-top:16px;font-size:11px;color:#9CA3AF">Payment due within 14 days. VAT No. IE0000000A.</footer>`
  );
}

export function renderWorkOrderHtml(job: JobWithExtras) {
  const checklist = ''; // checklist injected separately if needed
  return shell(
    `Work Order ${job.job_number}`,
    header('WORK ORDER', job) +
      partyBlock(job) +
      `<section style="margin-bottom:16px"><div style="font-size:10px;text-transform:uppercase;color:#9CA3AF">Scope</div><div style="font-size:13px;color:#1F2937;margin-top:4px;white-space:pre-wrap">${job.description || '—'}</div></section>` +
      `<section style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:16px">
        <div><div style="font-size:10px;text-transform:uppercase;color:#9CA3AF">Estimated hours</div><div style="font-weight:600;margin-top:4px">${job.estimated_hours ?? '—'}</div></div>
        <div><div style="font-size:10px;text-transform:uppercase;color:#9CA3AF">Scheduled date</div><div style="font-weight:600;margin-top:4px">${job.scheduled_date || '—'}</div></div>
      </section>` +
      itemsTable(job.items) +
      checklist +
      `<section style="margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <div><div style="border-bottom:1px solid #1F2937;height:48px"></div><div style="font-size:11px;color:#4B5563;margin-top:4px">Technician signature</div></div>
        <div><div style="border-bottom:1px solid #1F2937;height:48px"></div><div style="font-size:11px;color:#4B5563;margin-top:4px">Customer signature</div></div>
      </section>`
  );
}

export async function fetchJobWithItems(supabase: any, jobId: string) {
  const { data: job, error: jErr } = await supabase
    .from('jobs')
    .select('*, client:clients(*)')
    .eq('id', jobId)
    .single();
  if (jErr || !job) return null;
  const { data: items } = await supabase
    .from('job_items')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  return { ...job, items: items || [] } as JobWithExtras;
}
