'use client';

import { useEffect, useState } from 'react';
import { Wrench, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { jobService } from '@/lib/supabase/service';
import type { Job } from '@/lib/types';

interface KanbanCardProps {
  jobNumber: string;
  clientName: string;
  address: string;
  badge?: string;
  badgeColor?: string;
  onClick?: () => void;
}

function KanbanCard({ jobNumber, clientName, address, badge, badgeColor = 'bg-gray-100 text-dark-gray', onClick }: KanbanCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-white rounded-lg border border-light-gray hover:border-vision-green/50 hover:shadow-sm transition-all duration-200 group"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-vision-green">{jobNumber}</span>
        {badge && (
          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${badgeColor}`}>
            {badge}
          </Badge>
        )}
      </div>
      <p className="text-sm font-medium text-charcoal truncate">{clientName}</p>
      <p className="text-xs text-mid-gray truncate mt-0.5">{address}</p>
      <div className="mt-2 flex items-center text-xs text-mid-gray group-hover:text-vision-green transition-colors">
        <span>View details</span>
        <ArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

interface ActionKanbanProps {
  onJobClick?: (jobId: string) => void;
}

export function ActionKanban({ onJobClick }: ActionKanbanProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    jobService.fetchJobs().then(setJobs).catch(() => setJobs([]));
  }, []);

  const pending = jobs.filter(j =>
    ['Lead', 'Quote', 'Quote Sent', 'Work Order', 'In Progress'].includes(j.status)
  );
  const completed = jobs
    .filter(j => j.status === 'Completed')
    .sort((a, b) => (b.completed_date || b.updated_at).localeCompare(a.completed_date || a.updated_at))
    .slice(0, 10);

  const columns = [
    {
      title: 'Pending Jobs',
      icon: Wrench,
      iconColor: 'text-solar-orange',
      iconBg: 'bg-orange-50',
      items: pending,
      badgeColor: 'bg-solar-orange/15 text-orange-dark',
    },
    {
      title: 'Recently Completed',
      icon: CheckCircle2,
      iconColor: 'text-vision-green',
      iconBg: 'bg-green-50',
      items: completed,
      badgeColor: 'bg-vision-green/15 text-green-dark',
    },
  ];

  return (
    <Card className="border-light-gray">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-charcoal">Action Required</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {columns.map(col => {
            const Icon = col.icon;
            return (
              <div key={col.title} className="space-y-2.5">
                <div className="flex items-center gap-2 pb-2 border-b border-light-gray">
                  <div className={`w-7 h-7 rounded-md ${col.iconBg} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${col.iconColor}`} />
                  </div>
                  <span className="text-sm font-medium text-charcoal">{col.title}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] bg-off-white text-mid-gray">
                    {col.items.length}
                  </Badge>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {col.items.length === 0 ? (
                    <p className="text-xs text-mid-gray text-center py-6">All clear! 🎉</p>
                  ) : (
                    col.items.map(job => (
                      <KanbanCard
                        key={job.id}
                        jobNumber={job.job_number}
                        clientName={job.contact_name || (job.client ? `${job.client.first_name} ${job.client.last_name}` : '—')}
                        address={job.address}
                        badge={job.status}
                        badgeColor={col.badgeColor}
                        onClick={() => onJobClick?.(job.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
