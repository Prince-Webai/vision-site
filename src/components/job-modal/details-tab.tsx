'use client';

import { useState, useEffect } from 'react';
import { Plus, GripVertical, Trash2, Search, Loader2, UserCircle2, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { JOB_STATUSES, JOB_CATEGORIES } from '@/lib/constants';
import { jobService } from '@/lib/supabase/service';
import { toast } from 'sonner';
import type { Client } from '@/lib/types';

interface ChecklistItemType {
  id: string;
  text: string;
  completed: boolean;
}

interface DetailsTabProps {
  jobId?: string;
  onSuccess?: () => void;
}

export function DetailsTab({ jobId, onSuccess }: DetailsTabProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Work Order');
  const [category, setCategory] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMobile, setContactMobile] = useState('');

  const [checklist, setChecklist] = useState<ChecklistItemType[]>([]);

  // Client search
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Eircode lookup
  const [eircode, setEircode] = useState('');
  const [eircodeLoading, setEircodeLoading] = useState(false);

  // Load clients for search
  useEffect(() => {
    jobService.fetchClients().then(setClients).catch(() => setClients([]));
  }, []);

  // Load existing job when editing
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      try {
        const job = await jobService.fetchJob(jobId);
        if (cancelled) return;
        setStatus(job.status || 'Work Order');
        setCategory(job.category || '');
        setPoNumber(job.po_number || '');
        setAddress(job.address || '');
        setEircode(extractEircode(job.address || ''));
        setDescription(job.description || '');
        const nameSrc = job.contact_name || (job.client ? `${job.client.first_name} ${job.client.last_name}` : '');
        const [f, ...rest] = nameSrc.trim().split(' ');
        setFirstName(f || '');
        setLastName(rest.join(' '));
        setContactEmail(job.contact_email || job.client?.email || '');
        setContactPhone(job.contact_phone || job.client?.phone || '');
        setContactMobile(job.client?.mobile || '');
        setSelectedClientId(job.client_id || null);
        if (job.client) setClientSearch(`${job.client.first_name} ${job.client.last_name}`);
        if (job.checklist && job.checklist.length > 0) {
          setChecklist(job.checklist.map((c: any) => ({ id: c.id, text: c.text, completed: c.completed })));
        }
      } catch (err: any) {
        console.error('Failed to load job:', err);
        toast.error(err?.message || 'Failed to load job');
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  const filteredClients = clients.filter(c => {
    if (!clientSearch.trim()) return false;
    const q = clientSearch.toLowerCase();
    return (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  function pickClient(c: Client) {
    setSelectedClientId(c.id);
    setClientSearch(`${c.first_name} ${c.last_name}`);
    setShowClientList(false);
    setFirstName(c.first_name);
    setLastName(c.last_name);
    setContactEmail(c.email || '');
    setContactPhone(c.phone || '');
    setContactMobile(c.mobile || '');
    if (!address && c.address) setAddress(c.address);
  }

  const addChecklistItem = () =>
    setChecklist([...checklist, { id: Date.now().toString(), text: '', completed: false }]);
  const removeChecklistItem = (id: string) => setChecklist(checklist.filter(i => i.id !== id));
  const toggleChecklistItem = (id: string) =>
    setChecklist(checklist.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
  const updateChecklistText = (id: string, text: string) =>
    setChecklist(checklist.map(i => i.id === id ? { ...i, text } : i));

  async function lookupEircode() {
    const code = eircode.trim();
    if (!code) { toast.error('Enter an Eircode'); return; }
    setEircodeLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ie&limit=1&q=${encodeURIComponent(code)}`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        toast.error('Eircode not found — type the address manually below');
        return;
      }
      const display = data[0].display_name;
      // Prepend Eircode so it persists with the address
      const withCode = display.toUpperCase().includes(code.toUpperCase())
        ? display
        : `${code}, ${display}`;
      setAddress(withCode);
      toast.success('Address filled from Eircode');
    } catch (err: any) {
      toast.error(err?.message || 'Lookup failed');
    } finally {
      setEircodeLoading(false);
    }
  }

  // Extract Irish Eircode pattern from a free-text address. Returns "" if none.
  function extractEircode(addr: string): string {
    if (!addr) return '';
    // Irish Eircode: routing key (letter + 2 digits) + space? + unique identifier (4 alphanum)
    const m = addr.toUpperCase().match(/\b([A-Z]\d{2})\s?([A-Z0-9]{4})\b/);
    return m ? `${m[1]} ${m[2]}` : '';
  }

  async function handleSave() {
    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName) { toast.error('Enter a first name'); return; }
    if (!address.trim()) { toast.error('Enter a job address'); return; }

    // Light phone validation — must contain at least 6 digits if provided
    const phoneDigits = (s: string) => (s.match(/\d/g) || []).length;
    if (contactPhone && phoneDigits(contactPhone) < 6) {
      toast.error('Phone looks invalid — use international format e.g. +353 1 234 5678');
      return;
    }
    if (contactMobile && phoneDigits(contactMobile) < 6) {
      toast.error('Mobile looks invalid — use international format e.g. +353 87 123 4567');
      return;
    }
    // Light email validation
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      toast.error('Email looks invalid');
      return;
    }

    // Embed Eircode in the address so it persists alongside the address text
    let finalAddress = address.trim();
    if (eircode.trim() && !finalAddress.toUpperCase().includes(eircode.trim().toUpperCase())) {
      finalAddress = `${eircode.trim()}, ${finalAddress}`;
    }

    setLoading(true);
    try {
      let clientId = selectedClientId;

      if (!clientId) {
        const newClient = await jobService.createClient({
          first_name: firstName || 'Unknown',
          last_name: lastName || '-',
          email: contactEmail,
          phone: contactPhone,
          mobile: contactMobile,
          address: finalAddress,
        });
        clientId = newClient.id;
      }

      const jobData: any = {
        client_id: clientId,
        address: finalAddress,
        status,
        category: category || null,
        description,
        po_number: poNumber,
        contact_name: fullName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      };

      let saved;
      if (jobId) saved = await jobService.updateJob(jobId, jobData);
      else       saved = await jobService.createJob(jobData);

      await jobService.saveChecklist(
        saved.id,
        checklist.filter(i => i.text.trim()).map(i => ({ text: i.text, completed: i.completed }))
      );

      toast.success(jobId ? 'Job updated' : 'Job created');
      onSuccess?.();
    } catch (err: any) {
      console.error('Failed to save job:', err);
      toast.error(err?.message || 'Failed to save job');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Search / Create Client */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mid-gray pointer-events-none" />
        <Input
          placeholder="Search or Create Client"
          value={clientSearch}
          onChange={(e) => { setClientSearch(e.target.value); setShowClientList(true); setSelectedClientId(null); }}
          onFocus={() => setShowClientList(true)}
          className="pl-9 h-10 bg-white border-light-gray"
        />
        {showClientList && filteredClients.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-light-gray rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
            {filteredClients.map(c => (
              <button
                key={c.id}
                onClick={() => pickClient(c)}
                className="w-full text-left px-3 py-2 hover:bg-off-white flex items-center gap-2"
              >
                <UserCircle2 className="w-4 h-4 text-mid-gray" />
                <div>
                  <p className="text-sm font-medium text-charcoal">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-mid-gray">{c.email}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Address + Eircode */}
      <div className="space-y-2 mb-4">
        <div className="flex gap-2">
          <Input
            placeholder="Eircode (e.g. D01 F5P2)"
            value={eircode}
            onChange={(e) => setEircode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupEircode(); } }}
            className="h-10 bg-white border-light-gray w-44 uppercase tracking-wider"
            maxLength={8}
          />
          <Button
            type="button"
            onClick={lookupEircode}
            disabled={eircodeLoading}
            variant="outline"
            className="h-10 gap-1.5 border-light-gray text-dark-gray hover:bg-off-white"
          >
            {eircodeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Lookup
          </Button>
        </div>
        <Input
          placeholder="Enter Job Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="h-10 bg-white border-light-gray"
        />
      </div>

      {/* Status / Category / PO Number */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-xs text-charcoal block mb-1">Job Status</label>
          <Select value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger className="h-9 bg-white border-light-gray text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.values(JOB_STATUSES).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-charcoal block mb-1">Job Category</label>
          <Select value={category || undefined} onValueChange={(v) => setCategory(v || '')}>
            <SelectTrigger className="h-9 bg-white border-light-gray text-sm"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {Object.values(JOB_CATEGORIES).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-charcoal block mb-1">PO Number</label>
          <Input
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            className="h-9 bg-white border-light-gray"
          />
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="text-xs text-charcoal block mb-1">Job Description</label>
        <Textarea
          placeholder="Describe the work that needs to be done"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[80px] bg-white border-light-gray text-sm resize-none"
        />
      </div>

      {/* Checklist */}
      <div className="border border-light-gray rounded-md mb-4 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-light-gray bg-off-white">
          <span className="text-sm font-medium text-charcoal">Checklist</span>
          <MoreVertical className="w-4 h-4 text-mid-gray" />
        </div>
        <div className="p-2 space-y-1">
          {checklist.map(item => (
            <div key={item.id} className="flex items-center gap-2 group px-1">
              <GripVertical className="w-3.5 h-3.5 text-light-gray cursor-grab shrink-0" />
              <Checkbox
                checked={item.completed}
                onCheckedChange={() => toggleChecklistItem(item.id)}
                className="border-light-gray data-[state=checked]:bg-vision-green data-[state=checked]:border-vision-green"
              />
              <Input
                value={item.text}
                onChange={(e) => updateChecklistText(item.id, e.target.value)}
                placeholder="Checklist item..."
                className={`h-7 flex-1 text-sm border-transparent bg-transparent focus:bg-white focus:border-light-gray ${
                  item.completed ? 'line-through text-mid-gray' : ''
                }`}
              />
              <button
                onClick={() => removeChecklistItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-mid-gray hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={addChecklistItem}
            className="flex items-center gap-1.5 px-1.5 py-1 text-sm text-vision-green hover:text-green-dark"
          >
            <Plus className="w-3.5 h-3.5" /> New Item
          </button>
        </div>
      </div>

      {/* Contacts */}
      <div className="mb-6">
        <label className="text-sm font-medium text-charcoal block mb-2">Contacts</label>
        <div className="flex gap-3">
          <div className="shrink-0">
            <div className="flex items-center gap-2 bg-off-white border border-light-gray rounded-md px-3 h-9">
              <UserCircle2 className="w-4 h-4 text-mid-gray" />
              <span className="text-xs font-medium text-dark-gray">Job Contact</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-9 bg-white border-light-gray text-sm"
              />
              <Input
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-9 bg-white border-light-gray text-sm"
              />
            </div>
            <Input
              type="email"
              placeholder="Email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="h-9 bg-white border-light-gray text-sm"
            />
            <Input
              placeholder="Phone (e.g. +353 1 234 5678)"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="h-9 bg-white border-light-gray text-sm"
            />
            <Input
              placeholder="Mobile (e.g. +353 87 123 4567)"
              value={contactMobile}
              onChange={(e) => setContactMobile(e.target.value)}
              className="h-9 bg-white border-light-gray text-sm"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="pt-2 pb-4">
        <Button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-vision-green hover:bg-green-light text-white h-10 font-semibold shadow-md shadow-vision-green/20"
        >
          {loading ? 'Saving...' : jobId ? 'Update Job' : 'Save Job'}
        </Button>
      </div>
    </div>
  );
}
