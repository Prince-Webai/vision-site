// In dev (no auth) we pick the first profile as the "current user".
// Used by server routes to stamp audit_logs / notes / uploads.

import { createAdminClient } from './admin';

let cached: { id: string; name: string } | null = null;
let cachedAt = 0;

export async function currentUserName(): Promise<string> {
  if (cached && Date.now() - cachedAt < 60_000) return cached.name;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (data) {
    cached = { id: data.id, name: data.full_name };
    cachedAt = Date.now();
    return data.full_name;
  }
  return 'User';
}
