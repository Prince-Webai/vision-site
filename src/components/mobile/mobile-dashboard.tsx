'use client';

import { useEffect, useState } from 'react';
import {
  CalendarDays, CloudRain, Wind, Droplets,
  Briefcase, Users, CheckCircle2, Clock3,
  ChevronRight, MapPin, AlertTriangle,
} from 'lucide-react';
import { jobService } from '@/lib/supabase/service';
import { JobModal } from '@/components/job-modal/job-modal';
import type { Job, WeatherData } from '@/lib/types';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Work Order':  { bg: 'bg-blue-50',   text: 'text-blue-600' },
  'In Progress': { bg: 'bg-amber-50',  text: 'text-amber-600' },
  'Completed':   { bg: 'bg-green-50',  text: 'text-vision-green' },
  'Cancelled':   { bg: 'bg-red-50',    text: 'text-red-500' },
  'Unsuccessful':{ bg: 'bg-gray-50',   text: 'text-mid-gray' },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: 'bg-gray-50', text: 'text-mid-gray' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}

export function MobileDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    Promise.all([
      jobService.fetchJobs(),
      fetch('/api/weather').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([j, w]) => {
      setJobs(j);
      if (w) setWeather(w);
    }).finally(() => setLoading(false));
  }, [refresh]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayJobs = jobs.filter(j => j.scheduled_date?.startsWith(todayStr));
  const inProgressJobs = jobs.filter(j => j.status === 'In Progress');
  const workOrderJobs = jobs.filter(j => j.status === 'Work Order');
  const completedToday = jobs.filter(j => j.status === 'Completed' && j.completed_date?.startsWith(todayStr));

  const openJob = (id: string) => {
    setSelectedJobId(id);
    setModalOpen(true);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-4 pb-6">

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-charcoal">{greeting} 👋</h1>
        <p className="text-sm text-mid-gray flex items-center gap-1 mt-0.5">
          <CalendarDays className="w-3.5 h-3.5" />
          {new Date().toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Weather Banner */}
      {weather && (
        <div className="bg-white rounded-xl border border-light-gray p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-mid-gray uppercase tracking-wider font-semibold">Dublin, Ireland</p>
            <p className="text-3xl font-bold text-charcoal mt-0.5">{weather.temperature}°C</p>
            <p className="text-sm text-dark-gray capitalize mt-0.5">{weather.condition}</p>
          </div>
          <div className="space-y-1.5 text-right">
            <p className="text-xs text-dark-gray flex items-center justify-end gap-1">
              <Wind className="w-3 h-3 text-mid-gray" /> {weather.wind_speed} km/h
            </p>
            <p className="text-xs text-dark-gray flex items-center justify-end gap-1">
              <CloudRain className="w-3 h-3 text-mid-gray" /> {weather.rain_probability}% rain
            </p>
            <p className="text-xs text-dark-gray flex items-center justify-end gap-1">
              <Droplets className="w-3 h-3 text-mid-gray" /> {weather.humidity}% humidity
            </p>
          </div>
        </div>
      )}

      {/* Weather Alert — high rain probability */}
      {weather && weather.rain_probability >= 70 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-medium">High rain probability today. Roof work may be impacted.</p>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-light-gray p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xs text-mid-gray font-medium uppercase tracking-wider">Scheduled</p>
          </div>
          <p className="text-2xl font-bold text-charcoal">{todayJobs.length}</p>
          <p className="text-[11px] text-mid-gray mt-0.5">jobs today</p>
        </div>

        <div className="bg-white rounded-xl border border-light-gray p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock3 className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xs text-mid-gray font-medium uppercase tracking-wider">Active</p>
          </div>
          <p className="text-2xl font-bold text-charcoal">{inProgressJobs.length}</p>
          <p className="text-[11px] text-mid-gray mt-0.5">in progress</p>
        </div>

        <div className="bg-white rounded-xl border border-light-gray p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-vision-green" />
            </div>
            <p className="text-xs text-mid-gray font-medium uppercase tracking-wider">Done</p>
          </div>
          <p className="text-2xl font-bold text-charcoal">{completedToday.length}</p>
          <p className="text-[11px] text-mid-gray mt-0.5">completed today</p>
        </div>

        <div className="bg-white rounded-xl border border-light-gray p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-xs text-mid-gray font-medium uppercase tracking-wider">Pending</p>
          </div>
          <p className="text-2xl font-bold text-charcoal">{workOrderJobs.length}</p>
          <p className="text-[11px] text-mid-gray mt-0.5">work orders</p>
        </div>
      </div>

      {/* Today's Jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-charcoal uppercase tracking-wider">Today's Jobs</h2>
          <span className="text-xs text-mid-gray">{todayJobs.length} scheduled</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-white rounded-xl border border-light-gray animate-pulse" />
            ))}
          </div>
        ) : todayJobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-light-gray p-6 text-center">
            <CalendarDays className="w-8 h-8 text-light-gray mx-auto mb-2" />
            <p className="text-sm text-mid-gray">No jobs scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayJobs.map(job => (
              <button
                key={job.id}
                onClick={() => openJob(job.id)}
                className="w-full bg-white rounded-xl border border-light-gray p-3.5 text-left hover:border-vision-green/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-vision-green">{job.job_number}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="text-sm font-semibold text-charcoal truncate">
                      {job.contact_name || (job.client ? `${job.client.first_name} ${job.client.last_name}` : '—')}
                    </p>
                    <p className="text-xs text-mid-gray flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0" /> {job.address}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-mid-gray shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* In Progress Jobs */}
      {inProgressJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-charcoal uppercase tracking-wider">In Progress</h2>
            <span className="text-xs text-mid-gray">{inProgressJobs.length} active</span>
          </div>
          <div className="space-y-2">
            {inProgressJobs.slice(0, 5).map(job => (
              <button
                key={job.id}
                onClick={() => openJob(job.id)}
                className="w-full bg-amber-50 rounded-xl border border-amber-100 p-3.5 text-left hover:border-amber-300 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-vision-green">{job.job_number}</span>
                      <span className="text-[11px] text-amber-600 font-semibold">● In Progress</span>
                    </div>
                    <p className="text-sm font-semibold text-charcoal truncate">
                      {job.contact_name || (job.client ? `${job.client.first_name} ${job.client.last_name}` : '—')}
                    </p>
                    <p className="text-xs text-mid-gray flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0" /> {job.address}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <JobModal
        key={refresh}
        open={modalOpen}
        onOpenChange={setModalOpen}
        jobId={selectedJobId}
        onSuccess={() => { setRefresh(r => r + 1); setSelectedJobId(undefined); }}
      />
    </div>
  );
}
