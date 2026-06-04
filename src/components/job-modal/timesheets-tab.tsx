'use client';

import { useEffect, useState } from 'react';
import { Play, Square, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { timesheetService } from '@/lib/supabase/service';
import type { Timesheet } from '@/lib/types';

interface TimesheetsTabProps {
  jobId?: string;
}

function fmtDuration(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function liveDuration(startedAt: string) {
  const ms = Date.now() - new Date(startedAt).getTime();
  return Math.max(0, ms / 60000);
}

export function TimesheetsTab({ jobId }: TimesheetsTabProps) {
  const [entries, setEntries] = useState<Timesheet[]>([]);
  const [openEntry, setOpenEntry] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [, forceTick] = useState(0);

  async function reload() {
    if (!jobId) return;
    try {
      const [list, open] = await Promise.all([
        timesheetService.fetchForJob(jobId),
        timesheetService.fetchOpenForUser(),
      ]);
      setEntries(list);
      setOpenEntry(open);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    reload();
  }, [jobId]);

  // Tick once a second so the live timer updates
  useEffect(() => {
    if (!openEntry) return;
    const id = setInterval(() => forceTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [openEntry]);

  async function handleClockIn() {
    if (!jobId) {
      toast.error('Save the job first');
      return;
    }
    setLoading(true);
    try {
      await timesheetService.clockIn(jobId);
      toast.success('Clocked in');
      await reload();
    } catch (err: any) {
      toast.error(err.message || 'Clock in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleClockOut() {
    setLoading(true);
    try {
      await timesheetService.clockOut();
      toast.success('Clocked out');
      await reload();
    } catch (err: any) {
      toast.error(err.message || 'Clock out failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this timesheet entry?')) return;
    try {
      await timesheetService.deleteEntry(id);
      toast.success('Entry deleted');
      await reload();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  }

  const openForThisJob = openEntry && openEntry.job_id === jobId;
  const liveMinutes = openForThisJob ? liveDuration(openEntry!.started_at) : 0;

  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const totalCost = entries.reduce((s, e) => s + (e.labor_cost ?? 0), 0);

  if (!jobId) {
    return (
      <div className="p-6 text-sm text-mid-gray">Save the job first to track time against it.</div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-off-white rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-mid-gray">Your status</div>
            <div className="font-semibold text-charcoal mt-1">
              {openForThisJob ? (
                <span className="text-vision-green">On the clock · {fmtDuration(liveMinutes)}</span>
              ) : openEntry ? (
                <span className="text-solar-orange">Clocked into another job</span>
              ) : (
                <span className="text-dark-gray">Off the clock</span>
              )}
            </div>
          </div>
          {openForThisJob ? (
            <Button
              onClick={handleClockOut}
              disabled={loading}
              className="bg-charcoal hover:bg-charcoal/90 text-white gap-2"
            >
              <Square className="w-4 h-4" /> Clock Out
            </Button>
          ) : (
            <Button
              onClick={handleClockIn}
              disabled={loading}
              className="bg-vision-green hover:bg-green-light text-white gap-2"
            >
              <Play className="w-4 h-4" /> Clock In
            </Button>
          )}
        </div>
        {openEntry && !openForThisJob && (
          <p className="text-xs text-mid-gray">
            Clocking in here will auto clock-out your other job.
          </p>
        )}
      </div>

      <Separator className="bg-light-gray" />

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-charcoal flex items-center gap-2">
            <Clock className="w-4 h-4" /> Entries
          </div>
          <div className="text-xs text-dark-gray">
            {fmtDuration(totalMinutes)} · ${totalCost.toFixed(2)}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="text-sm text-mid-gray py-8 text-center bg-off-white rounded-lg">
            No time recorded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(e => (
              <div
                key={e.id}
                className="flex items-center justify-between p-3 rounded-md border border-light-gray bg-white group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-charcoal truncate">
                    {e.profile?.full_name || 'Unknown'}
                  </div>
                  <div className="text-xs text-mid-gray">
                    {new Date(e.started_at).toLocaleString('en-AU')} →{' '}
                    {e.ended_at ? new Date(e.ended_at).toLocaleTimeString('en-AU') : <span className="text-vision-green">running</span>}
                  </div>
                </div>
                <div className="text-right mr-3">
                  <div className="text-sm font-medium text-charcoal">
                    {e.ended_at ? fmtDuration(e.duration_minutes) : fmtDuration(liveDuration(e.started_at))}
                  </div>
                  <div className="text-xs text-mid-gray">
                    {e.labor_cost != null ? `€${e.labor_cost.toFixed(2)}` : `@€${e.hourly_rate}/hr`}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="opacity-0 group-hover:opacity-100 text-mid-gray hover:text-destructive p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
