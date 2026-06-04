'use client';

import { useEffect, useState } from 'react';
import { Clock, User } from 'lucide-react';
import { format } from 'date-fns';

interface SavedTabProps {
  jobId?: string;
}

interface VersionEntry {
  id: string;
  action: string;
  user_name: string;
  details: string;
  created_at: string;
}

export function SavedTab({ jobId }: SavedTabProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setVersions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/jobs/${jobId}/notes`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setVersions((Array.isArray(data) ? data : []) as VersionEntry[]);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobId]);

  if (!jobId) {
    return (
      <div className="p-6 text-sm text-mid-gray">
        Save the job first to see version history.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div>
        <label className="text-sm font-medium text-charcoal">Version History</label>
        <p className="text-xs text-mid-gray mt-0.5">All changes and notes recorded for this job</p>
      </div>

      {loading ? (
        <p className="text-sm text-mid-gray text-center py-8">Loading…</p>
      ) : versions.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-8 h-8 text-light-gray mx-auto mb-3" />
          <p className="text-sm text-mid-gray">No history yet</p>
          <p className="text-xs text-mid-gray mt-1">Changes will appear here as you edit the job</p>
        </div>
      ) : (
        <div className="space-y-0">
          {versions.map((v, index) => (
            <div key={v.id} className="relative flex gap-4 pb-6">
              {index < versions.length - 1 && (
                <div className="absolute left-[15px] top-8 bottom-0 w-px bg-light-gray" />
              )}
              <div className="relative shrink-0 mt-1">
                <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center ${
                  index === 0
                    ? 'bg-vision-green/15 text-vision-green'
                    : 'bg-off-white text-mid-gray'
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-medium text-charcoal">{v.action}</p>
                {v.details && v.action !== v.details && (
                  <p className="text-xs text-dark-gray mt-0.5">{v.details}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-mid-gray">
                  <span>{format(new Date(v.created_at), 'dd/MM/yyyy h:mm a')}</span>
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {v.user_name || 'system'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
