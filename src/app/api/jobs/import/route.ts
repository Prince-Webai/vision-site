import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export interface ImportRow {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address: string;
  suburb?: string;
  description?: string;
  category?: string;
  status?: string;
  scheduled_date?: string;
  system_size?: string;
  po_number?: string;
  total_value?: string;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows }: { rows: ImportRow[] } = await req.json();
  if (!rows?.length) return NextResponse.json({ error: 'No rows provided' }, { status: 400 });

  const VALID_STATUSES = ['Work Order', 'In Progress', 'Completed', 'Cancelled', 'Unsuccessful'];
  const VALID_CATEGORIES = ['Installation', 'Service', 'Site Assessment'];

  let created = 0;
  const errors: string[] = [];

  // Fetch latest job number once
  const { data: latest } = await supabase
    .from('jobs')
    .select('job_number')
    .like('job_number', 'VS-%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNum = 1201;
  if (latest?.job_number) {
    const m = latest.job_number.match(/VS-(\d+)/);
    if (m) nextNum = parseInt(m[1], 10) + 1;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowLabel = `Row ${i + 2}`;

    if (!row.first_name && !row.last_name) {
      errors.push(`${rowLabel}: missing client name`);
      continue;
    }
    if (!row.address) {
      errors.push(`${rowLabel}: missing address`);
      continue;
    }

    try {
      // Upsert client by email, or insert new
      let clientId: string;
      if (row.email) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('email', row.email)
          .maybeSingle();

        if (existing) {
          clientId = existing.id;
        } else {
          const { data: newClient, error: cErr } = await supabase
            .from('clients')
            .insert({
              first_name: row.first_name || '',
              last_name: row.last_name || '',
              email: row.email,
              phone: row.phone || null,
              address: row.address,
            })
            .select('id')
            .single();
          if (cErr) throw new Error(`Client: ${cErr.message}`);
          clientId = newClient.id;
        }
      } else {
        const { data: newClient, error: cErr } = await supabase
          .from('clients')
          .insert({
            first_name: row.first_name || '',
            last_name: row.last_name || '',
            email: null,
            phone: row.phone || null,
            address: row.address,
          })
          .select('id')
          .single();
        if (cErr) throw new Error(`Client: ${cErr.message}`);
        clientId = newClient.id;
      }

      const status = VALID_STATUSES.includes(row.status || '') ? row.status! : 'Work Order';
      const category = VALID_CATEGORIES.includes(row.category || '') ? row.category! : 'Installation';

      const { error: jErr } = await supabase.from('jobs').insert({
        job_number: `VS-${nextNum}`,
        client_id: clientId,
        address: row.address,
        suburb: row.suburb || null,
        status,
        category,
        description: row.description || '',
        po_number: row.po_number || null,
        system_size: row.system_size || null,
        scheduled_date: row.scheduled_date || null,
        total_value: row.total_value ? parseFloat(row.total_value) : null,
      });

      if (jErr) throw new Error(`Job: ${jErr.message}`);
      nextNum++;
      created++;
    } catch (err: any) {
      errors.push(`${rowLabel}: ${err.message}`);
    }
  }

  return NextResponse.json({ created, errors });
}
