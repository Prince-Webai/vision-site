'use client';

import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileDashboard } from '@/components/mobile/mobile-dashboard';
import { WeatherWidget } from '@/components/dashboard/weather-widget';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { ActionKanban } from '@/components/dashboard/action-kanban';
import dynamic from 'next/dynamic';
const MapPreview = dynamic(
  () => import('@/components/dashboard/map-preview').then(m => m.MapPreview),
  { ssr: false, loading: () => (
    <div className="rounded-xl border border-light-gray h-[208px] flex items-center justify-center bg-off-white">
      <div className="w-6 h-6 border-4 border-vision-green/30 border-t-vision-green rounded-full animate-spin" />
    </div>
  ) }
);
import { JobModal } from '@/components/job-modal/job-modal';

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();
  const [refresh, setRefresh] = useState(0);

  const handleJobClick = (jobId: string) => {
    setSelectedJobId(jobId);
    setJobModalOpen(true);
  };

  // Mobile — only mount mobile component
  if (isMobile) {
    return <MobileDashboard />;
  }

  // Desktop — original layout, untouched
  return (
    <>
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Dashboard</h1>
          <p className="text-sm text-dark-gray mt-0.5">Overview of your operations today</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1">
            <WeatherWidget />
          </div>
          <div className="lg:col-span-3">
            <KpiCards />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ActionKanban onJobClick={handleJobClick} />
          </div>
          <div className="lg:col-span-1">
            <MapPreview />
          </div>
        </div>
      </div>

      <JobModal
        key={refresh}
        open={jobModalOpen}
        onOpenChange={setJobModalOpen}
        jobId={selectedJobId}
        onSuccess={() => { setRefresh(r => r + 1); setSelectedJobId(undefined); }}
      />
    </>
  );
}
