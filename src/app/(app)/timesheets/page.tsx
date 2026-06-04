'use client';

import { useEffect, useMemo, useState } from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileTimesheets } from '@/components/mobile/mobile-timesheets';
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { Clock, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { timesheetService } from '@/lib/supabase/service';
import type { Timesheet } from '@/lib/types';

type Range = 'today' | 'week' | '30d' | 'all';

function fmtDuration(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export default function TimesheetsPage() {
  const [range, setRange] = useState<Range>('week');
  const [entries, setEntries] = useState<(Timesheet & { job?: { id: string; job_number: string; address: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  const dateBounds = useMemo(() => {
    const now = new Date();
    if (range === 'today') return { from: format(now, 'yyyy-MM-dd'), to: undefined };
    if (range === 'week') {
      return {
        from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd'T'00:00:00"),
        to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd'T'23:59:59"),
      };
    }
    if (range === '30d') return { from: format(subDays(now, 30), 'yyyy-MM-dd'), to: undefined };
    return {};
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    timesheetService
      .fetchAll(dateBounds)
      .then(data => {
        if (!cancelled) setEntries(data);
      })
      .catch(err => console.error(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [dateBounds]);

  const totals = useMemo(() => {
    const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
    const totalCost = entries.reduce((s, e) => s + (e.labor_cost ?? 0), 0);
    const byStaff = new Map<string, { name: string; minutes: number; cost: number }>();
    for (const e of entries) {
      const k = e.profile_id;
      const name = e.profile?.full_name || 'Unknown';
      const cur = byStaff.get(k) || { name, minutes: 0, cost: 0 };
      cur.minutes += e.duration_minutes ?? 0;
      cur.cost += e.labor_cost ?? 0;
      byStaff.set(k, cur);
    }
    return { totalMinutes, totalCost, byStaff: Array.from(byStaff.values()) };
  }, [entries]);

  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileTimesheets />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal flex items-center gap-2">
            <Clock className="w-6 h-6 text-vision-green" /> Timesheets
          </h1>
          <p className="text-sm text-mid-gray mt-1">Labor hours and cost across all jobs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-mid-gray" />
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-light-gray p-4">
          <div className="text-xs uppercase tracking-wider text-mid-gray">Total hours</div>
          <div className="text-2xl font-semibold text-charcoal mt-1">{fmtDuration(totals.totalMinutes)}</div>
        </div>
        <div className="bg-white rounded-lg border border-light-gray p-4">
          <div className="text-xs uppercase tracking-wider text-mid-gray">Labor cost</div>
          <div className="text-2xl font-semibold text-charcoal mt-1">€{totals.totalCost.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg border border-light-gray p-4">
          <div className="text-xs uppercase tracking-wider text-mid-gray">Entries</div>
          <div className="text-2xl font-semibold text-charcoal mt-1">{entries.length}</div>
        </div>
      </div>

      {/* Per-staff rollup */}
      {totals.byStaff.length > 0 && (
        <div className="bg-white rounded-lg border border-light-gray p-4">
          <div className="text-sm font-medium text-charcoal mb-3">By staff</div>
          <div className="space-y-2">
            {totals.byStaff
              .sort((a, b) => b.minutes - a.minutes)
              .map(s => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <div className="text-dark-gray">{s.name}</div>
                  <div className="text-charcoal">
                    {fmtDuration(s.minutes)} · €{s.cost.toFixed(2)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Entries table */}
      <div className="bg-white rounded-lg border border-light-gray overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-off-white">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium text-mid-gray text-xs uppercase tracking-wider">Date</th>
              <th className="px-4 py-2 font-medium text-mid-gray text-xs uppercase tracking-wider">Staff</th>
              <th className="px-4 py-2 font-medium text-mid-gray text-xs uppercase tracking-wider">Job</th>
              <th className="px-4 py-2 font-medium text-mid-gray text-xs uppercase tracking-wider">Start</th>
              <th className="px-4 py-2 font-medium text-mid-gray text-xs uppercase tracking-wider">End</th>
              <th className="px-4 py-2 font-medium text-mid-gray text-xs uppercase tracking-wider text-right">Hours</th>
              <th className="px-4 py-2 font-medium text-mid-gray text-xs uppercase tracking-wider text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-mid-gray">Loading…</td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-mid-gray">No timesheet entries in this range.</td>
              </tr>
            ) : (
              entries.map(e => (
                <tr key={e.id} className="border-t border-light-gray">
                  <td className="px-4 py-2 text-dark-gray">{format(new Date(e.started_at), 'MMM d')}</td>
                  <td className="px-4 py-2 text-charcoal">{e.profile?.full_name || '—'}</td>
                  <td className="px-4 py-2 text-dark-gray">{e.job?.job_number || '—'}</td>
                  <td className="px-4 py-2 text-dark-gray">{format(new Date(e.started_at), 'HH:mm')}</td>
                  <td className="px-4 py-2 text-dark-gray">
                    {e.ended_at ? format(new Date(e.ended_at), 'HH:mm') : <span className="text-vision-green">running</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-charcoal">{fmtDuration(e.duration_minutes)}</td>
                  <td className="px-4 py-2 text-right text-charcoal">
                    {e.labor_cost != null ? `€${e.labor_cost.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
