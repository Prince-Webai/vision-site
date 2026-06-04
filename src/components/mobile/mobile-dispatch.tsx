'use client';

import { useEffect, useState } from 'react';
import { Plus, MapPin, Users, Map, ChevronRight, Search, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { JobModal } from '@/components/job-modal/job-modal';
import { jobService } from '@/lib/supabase/service';
import dynamic from 'next/dynamic';
import type { Job } from '@/lib/types';

const DispatchMap = dynamic(
  () => import('@/components/dispatch/dispatch-map').then(m => m.DispatchMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 h-full flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-vision-green/30 border-t-vision-green rounded-full animate-spin" />
      </div>
    ),
  }
);

type Tab = 'jobs' | 'staff' | 'map';

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  'Work Order':  { dot: 'bg-blue-400',   bg: 'bg-blue-50',   text: 'text-blue-600' },
  'In Progress': { dot: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-600' },
  'Completed':   { dot: 'bg-green-400',  bg: 'bg-green-50',  text: 'text-vision-green' },
  'Cancelled':   { dot: 'bg-red-400',    bg: 'bg-red-50',    text: 'text-red-500' },
  'Unsuccessful':{ dot: 'bg-gray-300',   bg: 'bg-gray-50',   text: 'text-mid-gray' },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: 'bg-gray-50', text: 'text-mid-gray', dot: 'bg-gray-300' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}

export function MobileDispatch() {
  const [activeTab, setActiveTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      jobService.fetchJobs(),
      jobService.fetchProfiles(),
    ]).then(([j, p]) => {
      setJobs(j);
      setStaff(p.filter((p: any) => p.role === 'Technician' || p.role === 'Dispatcher'));
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  const filteredJobs = jobs.filter(j => {
    const matchSearch = !search || [
      j.job_number, j.address, j.contact_name,
      j.client?.first_name, j.client?.last_name,
    ].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openJob = (id?: string) => {
    setSelectedJobId(id);
    setModalOpen(true);
  };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'jobs',  label: 'Jobs',  icon: MapPin },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'map',   label: 'Map',   icon: Map },
  ];

  return (
    <div className="flex flex-col -m-4 h-[calc(100vh-4rem)]">

      {/* Tab Bar */}
      <div className="bg-white border-b border-light-gray flex shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-semibold transition-colors border-b-2 ${
                isActive
                  ? 'border-vision-green text-vision-green'
                  : 'border-transparent text-mid-gray'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Jobs Tab */}
      {activeTab === 'jobs' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Search + Filter */}
          <div className="bg-white border-b border-light-gray p-3 space-y-2 shrink-0">
            <div className="flex gap-2">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mid-gray" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search jobs..."
                  className="w-full pl-8 pr-8 py-2 text-sm bg-off-white border border-light-gray rounded-lg focus:outline-none focus:border-vision-green/50"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-mid-gray" />
                  </button>
                )}
              </div>
              {/* New Job */}
              <button
                onClick={() => openJob(undefined)}
                className="flex items-center gap-1.5 px-3 py-2 bg-solar-orange text-white text-sm font-semibold rounded-lg shrink-0"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            </div>

            {/* Status filter chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {['all', 'Work Order', 'In Progress', 'Completed', 'Cancelled'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    statusFilter === s
                      ? 'bg-vision-green text-white'
                      : 'bg-off-white text-dark-gray border border-light-gray'
                  }`}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Job List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-20 bg-white rounded-xl border border-light-gray animate-pulse" />
                ))}
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-8 text-center">
                <MapPin className="w-8 h-8 text-light-gray mx-auto mb-2" />
                <p className="text-sm text-mid-gray">No jobs found</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                <p className="text-xs text-mid-gray px-1">{filteredJobs.length} jobs</p>
                {filteredJobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => openJob(job.id)}
                    className="w-full bg-white rounded-xl border border-light-gray p-3.5 text-left hover:border-vision-green/40 hover:shadow-sm transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-bold text-vision-green">{job.job_number}</span>
                          <StatusBadge status={job.status} />
                          {job.category && (
                            <span className="text-[10px] text-mid-gray bg-off-white px-1.5 py-0.5 rounded border border-light-gray/50">
                              {job.category}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-charcoal truncate">
                          {job.contact_name || (job.client ? `${job.client.first_name} ${job.client.last_name}` : '—')}
                        </p>
                        <p className="text-xs text-mid-gray flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 shrink-0" /> {job.address}
                        </p>
                        {job.scheduled_date && (
                          <p className="text-[11px] text-mid-gray mt-0.5">
                            📅 {new Date(job.scheduled_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-mid-gray shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Staff Tab */}
      {activeTab === 'staff' && (
        <div className="flex-1 overflow-y-auto">
          {staff.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-8 h-8 text-light-gray mx-auto mb-2" />
              <p className="text-sm text-mid-gray">No staff members yet</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {staff.map((s: any) => {
                const assignedJobs = jobs.filter(j => j.assigned_to === s.id && j.status === 'In Progress');
                const initials = s.full_name.split(' ').map((n: string) => n[0]).join('');
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-light-gray p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 border-2 border-green-light/30 shrink-0">
                        <AvatarFallback className="bg-vision-green/10 text-green-dark text-sm font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-charcoal">{s.full_name}</p>
                        <p className="text-xs text-mid-gray">{s.role}</p>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                        assignedJobs.length > 0
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-green-50 text-vision-green'
                      }`}>
                        {assignedJobs.length > 0 ? 'On Site' : 'Available'}
                      </span>
                    </div>
                    {assignedJobs.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-light-gray space-y-1.5">
                        {assignedJobs.map(j => (
                          <button
                            key={j.id}
                            onClick={() => openJob(j.id)}
                            className="w-full flex items-center gap-2 text-left"
                          >
                            <span className="text-[11px] font-bold text-vision-green">{j.job_number}</span>
                            <span className="text-xs text-dark-gray truncate flex-1">{j.address}</span>
                            <ChevronRight className="w-3 h-3 text-mid-gray shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Map Tab */}
      {activeTab === 'map' && (
        <div className="flex-1 min-h-0">
          <DispatchMap
            refreshKey={refreshKey}
            onNewJob={() => openJob(undefined)}
          />
        </div>
      )}

      <JobModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        jobId={selectedJobId}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
}
