'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { Clock, Filter, ChevronDown, User } from 'lucide-react';
import { timesheetService } from '@/lib/supabase/service';
import type { Timesheet } from '@/lib/types';

type Range = 'today' | 'week' | '30d' | 'all';

const RANGE_LABELS: Record<Range, string> = {
  today: 'Today',
  week: 'This week',
  '30d': 'Last 30 days',
  all: 'All time',
};

function fmtDuration(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function MobileTimesheets() {
  const [range, setRange] = useState<Range>('week');
  const [showRangePicker, setShowRangePicker] = useState(false);
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
      .then(data => { if (!cancelled) setEntries(data); })
      .catch(console.error)
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
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

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, typeof entries>();
    for (const e of entries) {
      const day = format(new Date(e.started_at), 'yyyy-MM-dd');
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(e);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  return (
    <div className="space-y-4 pb-6">

      {/* Header + Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-vision-green" />
          <h1 className="text-xl font-bold text-charcoal">Timesheets</h1>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowRangePicker(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-light-gray rounded-lg text-sm font-medium text-dark-gray"
          >
            <Filter className="w-3.5 h-3.5 text-mid-gray" />
            {RANGE_LABELS[range]}
            <ChevronDown className="w-3.5 h-3.5 text-mid-gray" />
          </button>
          {showRangePicker && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-light-gray rounded-xl shadow-lg z-20 overflow-hidden min-w-[140px]">
              {(Object.entries(RANGE_LABELS) as [Range, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setRange(val); setShowRangePicker(false); }}
                  className={`w-full px-4 py-2.5 text-sm text-left transition-colors ${
                    range === val
                      ? 'bg-vision-green/5 text-vision-green font-semibold'
                      : 'text-dark-gray hover:bg-off-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl border border-light-gray p-3 text-center">
          <p className="text-[10px] text-mid-gray uppercase tracking-wider font-semibold">Hours</p>
          <p className="text-lg font-bold text-charcoal mt-1">{fmtDuration(totals.totalMinutes)}</p>
        </div>
        <div className="bg-white rounded-xl border border-light-gray p-3 text-center">
          <p className="text-[10px] text-mid-gray uppercase tracking-wider font-semibold">Cost</p>
          <p className="text-lg font-bold text-charcoal mt-1">€{totals.totalCost.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-light-gray p-3 text-center">
          <p className="text-[10px] text-mid-gray uppercase tracking-wider font-semibold">Entries</p>
          <p className="text-lg font-bold text-charcoal mt-1">{entries.length}</p>
        </div>
      </div>

      {/* By Staff Summary */}
      {totals.byStaff.length > 0 && (
        <div className="bg-white rounded-xl border border-light-gray p-4">
          <p className="text-xs font-bold text-charcoal uppercase tracking-wider mb-3">By Staff</p>
          <div className="space-y-2">
            {totals.byStaff.sort((a, b) => b.minutes - a.minutes).map(s => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-vision-green/10 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-vision-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">{s.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-charcoal">{fmtDuration(s.minutes)}</p>
                  <p className="text-[11px] text-mid-gray">€{s.cost.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entries by Date */}
      <div>
        <p className="text-xs font-bold text-charcoal uppercase tracking-wider mb-3">Entries</p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white rounded-xl border border-light-gray animate-pulse" />
            ))}
          </div>
        ) : groupedEntries.length === 0 ? (
          <div className="bg-white rounded-xl border border-light-gray p-6 text-center">
            <Clock className="w-8 h-8 text-light-gray mx-auto mb-2" />
            <p className="text-sm text-mid-gray">No entries in this period</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedEntries.map(([day, dayEntries]) => (
              <div key={day}>
                {/* Date Header */}
                <p className="text-xs font-bold text-mid-gray uppercase tracking-wider mb-2 px-1">
                  {format(new Date(day), 'EEEE, MMM d')}
                </p>
                <div className="space-y-2">
                  {dayEntries.map(e => (
                    <div key={e.id} className="bg-white rounded-xl border border-light-gray p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-vision-green">
                              {e.job?.job_number || '—'}
                            </span>
                            {!e.ended_at && (
                              <span className="text-[10px] bg-green-50 text-vision-green font-semibold px-1.5 py-0.5 rounded-full">
                                ● Running
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-charcoal truncate">
                            {e.profile?.full_name || '—'}
                          </p>
                          <p className="text-xs text-mid-gray mt-0.5">
                            {format(new Date(e.started_at), 'HH:mm')}
                            {' → '}
                            {e.ended_at ? format(new Date(e.ended_at), 'HH:mm') : 'now'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-charcoal">{fmtDuration(e.duration_minutes)}</p>
                          <p className="text-xs text-mid-gray">
                            {e.labor_cost != null ? `€${e.labor_cost.toFixed(2)}` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
