'use client';

import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileDispatch } from '@/components/mobile/mobile-dispatch';
import {
  Plus, UserPlus, X,
  Map, ListChecks, CalendarDays, Users, FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { JobModal } from '@/components/job-modal/job-modal';
import { JobsPanel } from '@/components/dispatch/jobs-panel';
import dynamic from 'next/dynamic';
const DispatchMap = dynamic(
  () => import('@/components/dispatch/dispatch-map').then(m => m.DispatchMap),
  { ssr: false, loading: () => (
    <div className="flex-1 h-full flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-vision-green/30 border-t-vision-green rounded-full animate-spin" />
    </div>
  ) }
);
import { TasksView } from '@/components/dispatch/tasks-view';
import { CalendarView } from '@/components/dispatch/calendar-view';
import { StaffScheduleView } from '@/components/dispatch/staff-schedule-view';
import { jobService } from '@/lib/supabase/service';
import { USER_ROLES } from '@/lib/constants';
import { toast } from 'sonner';
import { ImportModal } from '@/components/dispatch/import-modal';

const TABS = [
  { id: 'map', label: 'Dispatch Map', icon: Map },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'schedules', label: 'Staff Schedules', icon: Users },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function DispatchPage() {
  const [activeTab, setActiveTab] = useState<TabId>('schedules');
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>(USER_ROLES.TECHNICIAN);
  const [inviteRate, setInviteRate] = useState('0');
  const [inviteSaving, setInviteSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const loadStaff = () => {
    jobService.fetchProfiles()
      .then(list => setStaffMembers(list.filter((p: any) => p.role === 'Technician' || p.role === 'Dispatcher')))
      .catch(() => setStaffMembers([]));
  };

  useEffect(loadStaff, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error('Name and email required');
      return;
    }
    setInviteSaving(true);
    try {
      await jobService.createProfile({
        full_name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        hourly_rate: Number(inviteRate) || 0,
      });
      toast.success(`Invited ${inviteName}`);
      setInviteName(''); setInviteEmail(''); setInviteRate('0'); setInviteRole(USER_ROLES.TECHNICIAN);
      setInviteOpen(false);
      handleRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Invite failed');
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleRemoveStaff(id: string, name: string) {
    if (!confirm(`Remove ${name} from staff?`)) return;
    try {
      await jobService.deleteProfile(id);
      toast.success('Staff removed');
      handleRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Remove failed');
    }
  }

  const handleJobDoubleClick = (jobId: string) => {
    setSelectedJobId(jobId);
    setJobModalOpen(true);
  };

  const isMobile = useIsMobile();

  // Mobile — only mount mobile component (prevents Leaflet map from mounting hidden)
  if (isMobile) {
    return <MobileDispatch />;
  }

  // Desktop — original layout, untouched
  return (
    <>
      <div className="flex flex-col h-[calc(100vh-7rem)] -m-6 mt-0">
        {/* ── Top Action Bar ── */}
        <div className="bg-white border-b border-light-gray shrink-0">
          <div className="flex items-center h-[72px] px-4">
            {/* Actions */}
            <div className="flex items-center gap-1 pr-5 border-r border-light-gray">
              <span className="text-[10px] text-mid-gray uppercase tracking-wider mr-2 font-medium">Actions</span>
              <Button
                onClick={() => { setSelectedJobId(undefined); setJobModalOpen(true); }}
                className="bg-solar-orange hover:bg-orange-light text-white gap-1.5 h-9 px-3 text-xs font-semibold shadow-sm shadow-solar-orange/20"
              >
                <Plus className="w-3.5 h-3.5" />
                New Job
              </Button>
              <Button
                onClick={() => setImportOpen(true)}
                variant="outline"
                className="gap-1.5 h-9 px-3 text-xs font-semibold border-vision-green text-vision-green hover:bg-vision-green/5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Import Sheet
              </Button>
            </div>

            {/* Staff Members */}
            <div className="flex items-center gap-3 px-5 flex-1">
              <span className="text-[10px] text-mid-gray uppercase tracking-wider font-medium">Staff Members</span>
              <div className="flex items-center gap-2 flex-wrap">
                {staffMembers.length === 0 && (
                  <span className="text-xs text-mid-gray italic">No staff yet — click Invite</span>
                )}
                {staffMembers.map(s => (
                  <div key={s.id} className="relative flex flex-col items-center gap-1 group">
                    <Avatar className="w-9 h-9 border-2 border-green-light/30">
                      <AvatarFallback className="bg-vision-green/10 text-green-dark text-xs font-semibold">
                        {s.full_name.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-dark-gray font-medium truncate max-w-[60px]">
                      {s.full_name.split(' ')[0]}
                    </span>
                    <button
                      onClick={() => handleRemoveStaff(s.id, s.full_name)}
                      className="absolute -top-1 -right-1 bg-white border border-light-gray rounded-full p-0.5 text-mid-gray hover:text-destructive hover:border-destructive shadow-sm"
                      title="Remove"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setInviteOpen(true)} className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg hover:bg-off-white transition-colors">
                  <div className="w-9 h-9 rounded-lg border-2 border-dashed border-light-gray flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-mid-gray" />
                  </div>
                  <span className="text-[10px] text-mid-gray font-medium">Invite</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div className="bg-white border-b border-light-gray shrink-0 flex items-center px-4">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  isActive
                    ? 'border-vision-green text-vision-green'
                    : 'border-transparent text-dark-gray hover:text-charcoal hover:border-light-gray'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Main Content ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Tab Content */}
          <div className="flex-1 min-w-0 overflow-auto">
            {activeTab === 'map' && <DispatchMap refreshKey={refreshKey} onNewJob={() => { setSelectedJobId(undefined); setJobModalOpen(true); }} />}
            {activeTab === 'tasks' && <TasksView refreshKey={refreshKey} onJobClick={handleJobDoubleClick} />}
            {activeTab === 'calendar' && <CalendarView />}
            {activeTab === 'schedules' && <StaffScheduleView refreshKey={refreshKey} onJobClick={handleJobDoubleClick} />}
          </div>

          {/* Right: Jobs Panel (always visible) */}
          <JobsPanel onJobDoubleClick={handleJobDoubleClick} refreshKey={refreshKey} />
        </div>
      </div>

      <JobModal
        open={jobModalOpen}
        onOpenChange={setJobModalOpen}
        jobId={selectedJobId}
        onSuccess={handleRefresh}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleRefresh}
      />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-charcoal">Full name</label>
              <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="e.g. Aoife Murphy" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-charcoal">Email</label>
              <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@visionsolar.ie" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-charcoal">Role</label>
                <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technician">Technician</SelectItem>
                    <SelectItem value="Dispatcher">Dispatcher</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-charcoal">Hourly rate (€)</label>
                <Input type="number" min={0} value={inviteRate} onChange={e => setInviteRate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={handleInvite} disabled={inviteSaving} className="bg-vision-green hover:bg-green-light text-white">
                {inviteSaving ? 'Adding…' : 'Add Staff'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
