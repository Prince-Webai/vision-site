'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, Info, Send, FileText, ImageIcon, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface NotesPanelProps {
  jobId?: string;
}

interface ActivityEntry {
  id: string;
  action: string;
  user_name: string;
  details: string;
  created_at: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

export function NotesPanel({ jobId }: NotesPanelProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAll() {
    if (!jobId) { setEntries([]); setAttachments([]); return; }
    const [notes, atts] = await Promise.all([
      fetch(`/api/jobs/${jobId}/notes`).then(r => r.json()).catch(() => []),
      fetch(`/api/jobs/${jobId}/attachments`).then(r => r.json()).catch(() => []),
    ]);
    setEntries((Array.isArray(notes) ? notes : []) as ActivityEntry[]);
    setAttachments(Array.isArray(atts) ? atts : []);
  }

  useEffect(() => { loadAll(); }, [jobId]);

  async function addNote() {
    if (!jobId) { toast.error('Save the job first'); return; }
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setNote('');
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add note');
    } finally {
      setSaving(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!jobId) { toast.error('Save the job first'); return; }
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append('file', f);
        const res = await fetch(`/api/jobs/${jobId}/attachments`, { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || `Upload failed: ${f.name}`); continue; }
        toast.success(`Uploaded ${f.name}`);
      }
      await loadAll();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function deleteAttachment(id: string, name: string) {
    if (!jobId) return;
    if (!confirm(`Delete ${name}?`)) return;
    const res = await fetch(`/api/jobs/${jobId}/attachments?attachmentId=${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); await loadAll(); }
    else toast.error('Delete failed');
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,application/pdf,audio/*"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Note input */}
      <div className="p-3 border-b border-light-gray bg-white space-y-2">
        <div className="relative">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={jobId ? 'Type a job note here…' : 'Save the job first to add notes'}
            disabled={!jobId || saving}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }
            }}
            className="w-full min-h-[56px] px-2 py-2 pr-8 text-sm bg-yellow-50 border border-yellow-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:opacity-50"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!jobId || uploading}
            className="absolute top-2 right-2 text-mid-gray hover:text-dark-gray disabled:opacity-40"
            title="Attach file"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addNote}
            disabled={!jobId || saving || !note.trim()}
            className="flex-1 bg-vision-green hover:bg-green-light text-white text-xs font-medium py-1.5 rounded flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3 h-3" /> {saving ? 'Saving…' : 'Add Note'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!jobId || uploading}
            className="px-3 bg-off-white hover:bg-light-gray border border-light-gray text-dark-gray text-xs font-medium py-1.5 rounded flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Paperclip className="w-3 h-3" /> {uploading ? 'Uploading…' : 'File'}
          </button>
        </div>
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="p-3 border-b border-light-gray bg-white space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-mid-gray font-medium">Attachments</div>
          {attachments.map(a => {
            const isImg = a.file_type.startsWith('image/');
            const Icon = isImg ? ImageIcon : FileText;
            return (
              <div key={a.id} className="flex items-center gap-2 group text-xs">
                <Icon className="w-3.5 h-3.5 text-mid-gray shrink-0" />
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate text-dark-gray hover:text-vision-green hover:underline"
                  title={a.file_name}
                >
                  {a.file_name}
                </a>
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-mid-gray hover:text-vision-green"
                  title="Open"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => deleteAttachment(a.id, a.file_name)}
                  className="text-mid-gray hover:text-destructive opacity-0 group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Activity feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {entries.length === 0 && (
          <div className="text-xs text-mid-gray text-center py-8">
            {jobId ? 'No activity yet' : 'Notes and activity appear here'}
          </div>
        )}
        {entries.map(e => (
          <div key={e.id} className="flex gap-2.5">
            <div className="w-6 h-6 shrink-0 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Info className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-charcoal leading-tight">
                {e.action === 'Note' ? e.details : e.action}
              </p>
              <p className="text-[11px] text-mid-gray mt-0.5">
                {format(new Date(e.created_at), 'h:mm a dd/MM/yyyy')} · by {e.user_name || 'system'}
              </p>
              {e.action !== 'Note' && e.details && (
                <p className="text-xs text-dark-gray mt-1">{e.details}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
