import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { jobService } from '@/lib/supabase/service';
import type { Job } from '@/lib/types';

const TIME_SLOTS = [
  '7:00 am', '8:00 am', '9:00 am', '10:00 am', '11:00 am',
  '12:00 pm', '1:00 pm', '2:00 pm', '3:00 pm', '4:00 pm',
  '5:00 pm', '6:00 pm',
];

const VIEWS = ['Day', 'Week', '2 weeks', 'Month'] as const;

interface ScheduledBlock {
  jobId: string;
  staffId: string;
  slotIndex: number; // which time slot it starts at
  duration: number;  // how many slots it spans
}

interface StaffScheduleViewProps {
  onJobClick: (jobId: string) => void;
  refreshKey?: number;
}

export function StaffScheduleView({ onJobClick, refreshKey }: StaffScheduleViewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<string>('Day');
  const [scheduledBlocks, setScheduledBlocks] = useState<ScheduledBlock[]>([]);
  const [dragOverCell, setDragOverCell] = useState<{ staffId: string; slotIndex: number } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [jobsData, profiles] = await Promise.all([
          jobService.fetchJobs(),
          jobService.fetchProfiles(),
        ]);
        setJobs(jobsData);
        setStaffMembers(profiles.filter((p: any) => p.role === 'Technician' || p.role === 'Dispatcher'));
      } catch (error) {
        console.error('Failed to load schedule data:', error?.message || error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [refreshKey]);

  // Days that the current view spans (1 for Day, 7 for Week, 14 for 2 weeks, ~30 for Month)
  const viewDays = view === 'Day' ? 1 : view === 'Week' ? 7 : view === '2 weeks' ? 14 : 30;

  const visibleDates: Date[] = (() => {
    const start = new Date(selectedDate);
    if (view === 'Week') {
      // Snap to Monday
      const dow = (start.getDay() + 6) % 7; // 0 = Monday
      start.setDate(start.getDate() - dow);
    } else if (view === '2 weeks') {
      const dow = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - dow);
    } else if (view === 'Month') {
      start.setDate(1);
    }
    return Array.from({ length: viewDays }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  })();

  const dateLabel = (() => {
    if (view === 'Day') {
      return selectedDate.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    }
    const first = visibleDates[0];
    const last = visibleDates[visibleDates.length - 1];
    if (view === 'Month') {
      return first.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' });
    }
    const fmt = (d: Date) => d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
    return `${fmt(first)} – ${fmt(last)} ${last.getFullYear()}`;
  })();

  const stepBack = () => setSelectedDate(d => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() - viewDays);
    return nd;
  });
  const stepFwd = () => setSelectedDate(d => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + viewDays);
    return nd;
  });
  const goToday = () => setSelectedDate(new Date());

  // For Day view, columns are TIME_SLOTS (hourly). For multi-day views, columns are dates.
  const columns = view === 'Day' ? TIME_SLOTS : visibleDates.map(d =>
    d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: view === 'Month' ? undefined : 'short' })
  );

  // For multi-day views, count jobs scheduled per (staff, date) from DB scheduled_date + assigned_to
  const jobsForCell = (staffId: string, date: Date) => {
    const iso = date.toISOString().slice(0, 10);
    return jobs.filter(j => j.assigned_to === staffId && j.scheduled_date === iso);
  };

  const handleDragOver = useCallback((e: React.DragEvent, staffId: string, slotIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell({ staffId, slotIndex });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCell(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, staffId: string, slotIndex: number) => {
    e.preventDefault();
    setDragOverCell(null);

    const jobId = e.dataTransfer.getData('application/job-id');
    if (!jobId) return;

    // Find the job to determine duration
    const job = jobs.find(j => j.id === jobId);
    const duration = job?.estimated_hours ? Math.ceil(job.estimated_hours) : 1;

    // Remove any existing block for this job
    setScheduledBlocks(prev => {
      const filtered = prev.filter(b => b.jobId !== jobId);
      return [...filtered, { jobId, staffId, slotIndex, duration }];
    });
  }, []);

  const removeBlock = (jobId: string) => {
    setScheduledBlocks(prev => prev.filter(b => b.jobId !== jobId));
  };

  const getBlockForCell = (staffId: string, slotIndex: number): ScheduledBlock | undefined => {
    return scheduledBlocks.find(b =>
      b.staffId === staffId && b.slotIndex === slotIndex
    );
  };

  const isCellOccupied = (staffId: string, slotIndex: number): boolean => {
    return scheduledBlocks.some(b =>
      b.staffId === staffId &&
      slotIndex >= b.slotIndex &&
      slotIndex < b.slotIndex + b.duration
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-light-gray bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={goToday}
            className="text-xs text-mid-gray font-medium hover:text-charcoal px-2 py-1 rounded hover:bg-off-white transition-colors"
          >
            Today
          </button>
          <button onClick={stepBack} className="text-mid-gray hover:text-charcoal p-0.5 rounded hover:bg-off-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={stepFwd} className="text-mid-gray hover:text-charcoal p-0.5 rounded hover:bg-off-white">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <span className="text-sm font-semibold text-charcoal">{dateLabel}</span>

        <div className="flex items-center bg-off-white rounded-md p-0.5 border border-light-gray">
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                view === v
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-mid-gray hover:text-dark-gray'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full border-collapse min-w-[900px]">
          {/* Column header */}
          <thead>
            <tr>
              <th className="w-[120px] min-w-[120px] px-3 py-2 text-left border-b border-r border-light-gray bg-off-white sticky top-0 left-0 z-30 shadow-[1px_0_0_0_rgba(229,231,235,1)]">
                <span className="text-[10px] text-mid-gray uppercase tracking-wider font-semibold">Staff</span>
              </th>
              {columns.map((label, i) => {
                const isToday = view !== 'Day' && visibleDates[i] && visibleDates[i].toDateString() === new Date().toDateString();
                return (
                  <th
                    key={i}
                    onClick={view !== 'Day' && visibleDates[i] ? () => { setSelectedDate(visibleDates[i]); setView('Day'); } : undefined}
                    className={`min-w-[80px] px-2 py-2 text-center border-b border-r border-light-gray sticky top-0 z-20 ${isToday ? 'bg-vision-green/10' : 'bg-off-white'} ${view!=='Day' ? 'cursor-pointer hover:bg-off-white/80' : ''}`}
                  >
                    <span className={`text-[10px] font-medium ${isToday ? 'text-vision-green' : 'text-mid-gray'}`}>{label}</span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Staff rows */}
          <tbody>
            {staffMembers.map(staff => (
              <tr key={staff.id} className="group/row">
                {/* Staff name cell */}
                <td className="px-3 py-3 border-b border-r border-light-gray bg-white sticky left-0 z-10 shadow-[1px_0_0_0_rgba(229,231,235,1)]">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarFallback className="bg-vision-green/10 text-green-dark text-[10px] font-semibold">
                        {staff.full_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-charcoal truncate">{staff.full_name}</span>
                  </div>
                </td>

                {/* Multi-day view: one cell per date showing assigned jobs */}
                {view !== 'Day' && visibleDates.map((date, di) => {
                  const cellJobs = jobsForCell(staff.id, date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <td
                      key={di}
                      className={`align-top border-b border-r border-light-gray min-h-[64px] p-1 ${isToday ? 'bg-vision-green/5' : 'hover:bg-off-white/50'}`}
                    >
                      <div className="min-h-[60px] flex flex-col gap-1">
                        {cellJobs.length === 0 ? (
                          <div className="h-full" />
                        ) : cellJobs.map(j => {
                          const isQuote = j.status === 'In Progress';
                          return (
                            <button
                              key={j.id}
                              onClick={() => onJobClick(j.id)}
                              className={`text-left rounded px-1.5 py-1 text-[10px] font-medium truncate ${
                                isQuote
                                  ? 'bg-solar-orange/20 text-orange-dark hover:bg-solar-orange/30'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                              }`}
                            >
                              {j.job_number}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}

                {/* Day view: one cell per hour slot */}
                {view === 'Day' && TIME_SLOTS.map((_, slotIndex) => {
                  const block = getBlockForCell(staff.id, slotIndex);
                  const occupied = !block && isCellOccupied(staff.id, slotIndex);
                  const isHovered = dragOverCell?.staffId === staff.id && dragOverCell?.slotIndex === slotIndex;

                  // If this cell is occupied by a block that starts earlier, skip rendering content
                  if (occupied) {
                    return null; // will be covered by colspan of the block
                  }

                  if (block) {
                    const job = jobs.find(j => j.id === block.jobId);
                    const isQuote = job && job.status === 'In Progress';
                    return (
                      <td
                        key={slotIndex}
                        colSpan={block.duration}
                        className="border-b border-r border-light-gray p-1"
                      >
                        <div
                          className={`relative rounded-md px-2.5 py-1.5 h-full min-h-[44px] cursor-pointer group/block transition-all
                            ${isQuote
                              ? 'bg-solar-orange/15 border border-solar-orange/30 hover:bg-solar-orange/25'
                              : 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                            }`}
                          onClick={() => onJobClick(block.jobId)}
                        >
                          <p className={`text-xs font-semibold truncate ${isQuote ? 'text-orange-dark' : 'text-blue-700'}`}>
                            {job?.client?.first_name} {job?.client?.last_name}
                          </p>
                          <p className={`text-[10px] truncate mt-0.5 ${isQuote ? 'text-solar-orange' : 'text-blue-500'}`}>
                            {job?.job_number} • {block.duration}h
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeBlock(block.jobId); }}
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition-opacity shadow-sm hover:bg-red-50"
                          >
                            <X className="w-2.5 h-2.5 text-mid-gray hover:text-destructive" />
                          </button>
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={slotIndex}
                      className={`border-b border-r border-light-gray transition-colors min-h-[44px] ${
                        isHovered
                          ? 'bg-vision-green/10 ring-2 ring-inset ring-vision-green/30'
                          : 'hover:bg-off-white/50'
                      }`}
                      onDragOver={(e) => handleDragOver(e, staff.id, slotIndex)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, staff.id, slotIndex)}
                    >
                      <div className="min-h-[44px]" />
                    </td>
                  );
                })}
              </tr>
            ))}

            {staffMembers.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="text-center py-16">
                  <p className="text-sm text-mid-gray">No staff members found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drop hint */}
      <div className="bg-off-white border-t border-light-gray px-4 py-2 shrink-0">
        <p className="text-[10px] text-mid-gray text-center">
          {view === 'Day'
            ? "Drag jobs from the Jobs panel and drop them on a staff member's time slot to schedule"
            : "Click a date header to switch to Day view. Coloured pills are jobs assigned to that staff member on that date."}
        </p>
      </div>
    </div>
  );
}
