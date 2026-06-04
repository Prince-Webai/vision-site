'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X, ChevronRight, Clock, MapPin, SlidersHorizontal } from 'lucide-react';
import { jobService } from '@/lib/supabase/service';
import { JobModal } from '@/components/job-modal/job-modal';
import { AuditLog } from '@/components/history/audit-log';
import type { Job } from '@/lib/types';

type Tab = 'jobs' | 'activity';

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Work Order':  { dot: 'bg-blue-400',  bg: 'bg-blue-50',   text: 'text-blue-600' },
  'In Progress': { dot: 'bg-amber-400', bg: 'bg-amber-50',  text: 'text-amber-600' },
  'Completed':   { dot: 'bg-green-400', bg: 'bg-green-50',  text: 'text-vision-green' },
  'Cancelled':   { dot: 'bg-red-400',   bg: 'bg-red-50',    text: 'text-red-500' },
  'Unsuccessful':{ dot: 'bg-gray-300',  bg: 'bg-gray-50',   text: 'text-mid-gray' },
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

const DATE_RANGES = ['All', 'Today', 'Yesterday', 'Last 7 Days', 'This Month'];
const STATUS_FILTERS = ['All', 'Work Order', 'In Progress', 'Completed', 'Cancelled'];

const PAGE_SIZE = 20;

export function MobileHistory() {
  const [activeTab, setActiveTab] = useState<Tab>('jobs');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    jobService.fetchJobs().then(setAllJobs).catch(() => setAllJobs([]));
  }, [refresh]);

  const filteredJobs = useMemo(() => {
    let jobs = allJobs;
    if (search) {
      const q = search.toLowerCase();
      jobs = jobs.filter(j =>
        j.job_number.toLowerCase().includes(q) ||
        j.client?.first_name?.toLowerCase().includes(q) ||
        j.client?.last_name?.toLowerCase().includes(q) ||
        j.contact_name?.toLowerCase().includes(q) ||
        j.address.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') {
      jobs = jobs.filter(j => j.status === statusFilter);
    }
    if (dateRange !== 'All') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let startDate: Date;
      switch (dateRange) {
        case 'Today':     startDate = today; break;
        case 'Yesterday': startDate = new Date(today.getTime() - 86400000); break;
        case 'Last 7 Days': startDate = new Date(today.getTime() - 7 * 86400000); break;
        case 'This Month':  startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        default: startDate = new Date(0);
      }
      jobs = jobs.filter(j => {
        const d = j.completed_date ? new Date(j.completed_date) : new Date(j.created_at);
        return d >= startDate;
      });
    }
    return jobs;
  }, [allJobs, search, statusFilter, dateRange]);

  const hasActiveFilters = statusFilter !== 'All' || dateRange !== 'All';
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const paginatedJobs = filteredJobs.slice(0, page * PAGE_SIZE);

  const openJob = (id: string) => { setSelectedJobId(id); setModalOpen(true); };

  return (
    <div className="space-y-4 pb-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-charcoal">History</h1>
        <p className="text-sm text-mid-gray mt-0.5">View completed jobs and activity logs</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-off-white border border-light-gray rounded-lg p-1 gap-1">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
            activeTab === 'jobs'
              ? 'bg-white text-charcoal shadow-sm'
              : 'text-mid-gray'
          }`}
        >
          Job History
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
            activeTab === 'activity'
              ? 'bg-white text-charcoal shadow-sm'
              : 'text-mid-gray'
          }`}
        >
          Recent Changes
        </button>
      </div>

      {/* Jobs Tab */}
      {activeTab === 'jobs' && (
        <div className="space-y-3">
          {/* Search + Filter toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mid-gray" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search jobs, clients..."
                className="w-full pl-8 pr-8 py-2.5 text-sm bg-white border border-light-gray rounded-lg focus:outline-none focus:border-vision-green/50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-mid-gray" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                hasActiveFilters
                  ? 'bg-vision-green text-white border-vision-green'
                  : 'bg-white text-dark-gray border-light-gray'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </button>
          </div>

          {/* Expandable Filters */}
          {showFilters && (
            <div className="bg-white border border-light-gray rounded-xl p-4 space-y-3">
              {/* Status chips */}
              <div>
                <p className="text-[10px] font-bold text-mid-gray uppercase tracking-wider mb-2">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_FILTERS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setStatusFilter(s); setPage(1); }}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                        statusFilter === s
                          ? 'bg-vision-green text-white'
                          : 'bg-off-white text-dark-gray border border-light-gray'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {/* Date range chips */}
              <div>
                <p className="text-[10px] font-bold text-mid-gray uppercase tracking-wider mb-2">Date</p>
                <div className="flex flex-wrap gap-1.5">
                  {DATE_RANGES.map(d => (
                    <button
                      key={d}
                      onClick={() => { setDateRange(d); setPage(1); }}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                        dateRange === d
                          ? 'bg-vision-green text-white'
                          : 'bg-off-white text-dark-gray border border-light-gray'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={() => { setStatusFilter('All'); setDateRange('All'); setPage(1); }}
                  className="text-xs text-mid-gray underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Results count */}
          <p className="text-xs text-mid-gray px-1">{filteredJobs.length} records found</p>

          {/* Job Cards */}
          {filteredJobs.length === 0 ? (
            <div className="bg-white rounded-xl border border-light-gray p-8 text-center">
              <Clock className="w-8 h-8 text-light-gray mx-auto mb-2" />
              <p className="text-sm text-mid-gray">No jobs match your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => openJob(job.id)}
                  className="w-full bg-white rounded-xl border border-light-gray p-3.5 text-left hover:border-vision-green/30 transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-bold text-vision-green">{job.job_number}</span>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="text-sm font-semibold text-charcoal truncate">
                        {job.contact_name || (job.client ? `${job.client.first_name} ${job.client.last_name}` : '—')}
                      </p>
                      <p className="text-xs text-mid-gray flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> {job.address}
                      </p>
                      {(job.completed_date || job.scheduled_date) && (
                        <p className="text-[11px] text-mid-gray mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {job.completed_date
                            ? `Completed ${new Date(job.completed_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}`
                            : `Scheduled ${new Date(job.scheduled_date!).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}`
                          }
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-mid-gray shrink-0 mt-1" />
                  </div>
                </button>
              ))}

              {/* Load more */}
              {page < totalPages && (
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="w-full py-3 text-sm font-semibold text-vision-green bg-white border border-light-gray rounded-xl hover:bg-off-white transition-colors"
                >
                  Load more ({filteredJobs.length - paginatedJobs.length} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div className="bg-white border border-light-gray rounded-xl py-4 overflow-hidden">
          <div className="px-4 pb-3 border-b border-light-gray mb-4">
            <p className="text-sm font-semibold text-charcoal">Account Activity Log</p>
            <p className="text-xs text-mid-gray mt-0.5">Admin-only view of all recent changes</p>
          </div>
          <AuditLog />
        </div>
      )}

      <JobModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        jobId={selectedJobId}
        onSuccess={() => setRefresh(r => r + 1)}
      />
    </div>
  );
}
