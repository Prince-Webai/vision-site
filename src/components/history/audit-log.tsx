'use client';

import { useEffect, useState } from 'react';
import { Clock, User, ArrowRight, FileText, CheckCircle, Send, PlusCircle, Trash2, Paperclip, StickyNote } from 'lucide-react';
import { format } from 'date-fns';

interface AuditEntry {
  id: string;
  action: string;
  user_name: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
}

function iconFor(action: string) {
  const a = action.toLowerCase();
  if (a.includes('created'))  return { icon: PlusCircle, cls: 'bg-solar-orange/15 text-orange-dark' };
  if (a.includes('updated'))  return { icon: ArrowRight, cls: 'bg-blue-100 text-blue-600' };
  if (a.includes('completed')) return { icon: CheckCircle, cls: 'bg-vision-green/15 text-green-dark' };
  if (a.includes('sent') || a.includes('quote')) return { icon: Send, cls: 'bg-cyan-100 text-cyan-600' };
  if (a.includes('assigned')) return { icon: User, cls: 'bg-purple-100 text-purple-600' };
  if (a.includes('file') || a.includes('attach')) return { icon: Paperclip, cls: 'bg-gray-100 text-dark-gray' };
  if (a.includes('deleted'))  return { icon: Trash2, cls: 'bg-red-100 text-destructive' };
  if (a.includes('note'))     return { icon: StickyNote, cls: 'bg-yellow-100 text-yellow-700' };
  return { icon: FileText, cls: 'bg-gray-100 text-mid-gray' };
}

export function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/audit-logs?limit=200')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setLogs(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12 px-4 text-sm text-mid-gray">Loading activity…</div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Clock className="w-8 h-8 text-light-gray mx-auto mb-3" />
        <p className="text-sm text-mid-gray">No activity recorded yet</p>
        <p className="text-xs text-mid-gray mt-1">Job edits, notes and uploads will show here</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {logs.map((log, index) => {
        const { icon: Icon, cls } = iconFor(log.action);
        return (
          <div key={log.id} className="relative flex gap-4 pb-5 px-4">
            {index < logs.length - 1 && (
              <div className="absolute left-[31px] top-9 bottom-0 w-px bg-light-gray" />
            )}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cls}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-charcoal">
                <span className="font-medium">{log.user_name || 'system'}</span>{' '}
                <span className="text-dark-gray">{log.action.toLowerCase()}</span>
                {log.details && (
                  <>: <span className="text-dark-gray">{log.details}</span></>
                )}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-3 h-3 text-mid-gray" />
                <span className="text-xs text-mid-gray">
                  {format(new Date(log.created_at), 'dd/MM/yyyy h:mm a')}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
