'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Maximize2, Minimize2, X,
  Mail, MessageSquare, Trash2,
  ClipboardList, Clock, Bookmark,
} from 'lucide-react';
import { DetailsTab } from './details-tab';
import { SavedTab } from './saved-tab';
import { TimesheetsTab } from './timesheets-tab';
import { NotesPanel } from './notes-panel';
import { jobService } from '@/lib/supabase/service';
import { toast } from 'sonner';

const TABS = [
  { id: 'details',    label: 'Details',    icon: ClipboardList },
  { id: 'timesheets', label: 'Timesheets', icon: Clock },
  { id: 'saved',      label: 'Saved',      icon: Bookmark },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface JobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  onSuccess?: () => void;
}

export function JobModal({ open, onOpenChange, jobId, onSuccess }: JobModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [maximized, setMaximized] = useState(false);
  const [jobNumber, setJobNumber] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setActiveTab('details');
    if (jobId) {
      jobService
        .fetchJob(jobId)
        .then(j => setJobNumber(j.job_number || ''))
        .catch(() => setJobNumber(''));
    } else {
      setJobNumber('');
    }
  }, [open, jobId]);

  async function quickAction(action: 'send-quote' | 'send-sms') {
    if (!jobId) {
      toast.error('Save the job first');
      return;
    }
    setBusy(action);
    try {
      const res = await fetch(`/api/jobs/${jobId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Action failed'); return; }
      if (action === 'send-quote') toast.success(`Email sent (${data.provider}) to ${data.sentTo}`);
      else if (action === 'send-sms') toast.success(`SMS sent (${data.provider}) to ${data.sentTo}`);
    } catch (err: any) {
      toast.error(String(err));
    } finally { setBusy(null); }
  }

  async function handleDelete() {
    if (!jobId) return;
    if (!confirm('Delete this job? This cannot be undone.')) return;
    try {
      await jobService.deleteJob(jobId);
      toast.success('Job deleted');
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  }

  const sizeClass = maximized
    ? '!w-screen !h-screen !max-w-none !rounded-none'
    : '!w-[95vw] !h-[90vh] !max-w-[1400px] sm:!max-w-[1400px]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`p-0 ${sizeClass} bg-white flex flex-col overflow-hidden`}
      >
        {/* Orange header bar */}
        <div className="bg-solar-orange text-white px-4 h-11 flex items-center justify-between shrink-0">
          <div className="font-semibold text-sm">
            {jobId ? `Job ${jobNumber || '#…'}` : 'New Job'}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMaximized(m => !m)}
              className="p-1.5 rounded hover:bg-white/15"
              title={maximized ? 'Restore' : 'Maximise'}
            >
              {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="px-3 h-7 rounded bg-white/10 hover:bg-white/20 text-xs font-medium flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> Close
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left icon rail */}
          <div className="w-[88px] shrink-0 bg-off-white border-r border-light-gray flex flex-col items-center py-3 gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-[72px] py-2.5 flex flex-col items-center gap-1 rounded-md text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'bg-white border border-light-gray text-vision-green shadow-sm'
                      : 'text-mid-gray hover:bg-white/60 hover:text-dark-gray'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Center: toolbar + form */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Top action toolbar */}
            <div className="border-b border-light-gray px-4 py-2 flex items-center gap-1 shrink-0">
              <ToolbarButton icon={Mail}          label="Email" onClick={() => quickAction('send-quote')} disabled={!jobId || busy !== null} />
              <ToolbarButton icon={MessageSquare} label="SMS"   onClick={() => quickAction('send-sms')}   disabled={!jobId || busy !== null} />
              {jobId && (
                <div className="ml-auto">
                  <ToolbarButton
                    icon={Trash2}
                    label="Delete"
                    onClick={handleDelete}
                    danger
                  />
                </div>
              )}
            </div>

            {/* Form area */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-white">
              {activeTab === 'details' && (
                <DetailsTab jobId={jobId} onSuccess={() => { onSuccess?.(); onOpenChange(false); }} />
              )}
              {activeTab === 'timesheets' && <TimesheetsTab jobId={jobId} />}
              {activeTab === 'saved'      && <SavedTab      jobId={jobId} />}
            </div>
          </div>

          {/* Right notes panel */}
          <div className="w-[340px] shrink-0 border-l border-light-gray bg-off-white flex flex-col overflow-hidden">
            <NotesPanel jobId={jobId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolbarButton({
  icon: Icon, label, onClick, disabled, danger,
}: { icon: any; label: string; onClick?: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? 'text-destructive hover:bg-red-50'
          : 'text-dark-gray hover:bg-off-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
