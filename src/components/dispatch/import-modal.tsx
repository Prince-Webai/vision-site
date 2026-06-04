'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, Link, X, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { ImportRow } from '@/app/api/jobs/import/route';

// Normalise a CSV header to a field key
const HEADER_MAP: Record<string, keyof ImportRow> = {
  'first name': 'first_name', 'firstname': 'first_name', 'first_name': 'first_name',
  'last name': 'last_name', 'lastname': 'last_name', 'last_name': 'last_name',
  'surname': 'last_name',
  'email': 'email', 'email address': 'email',
  'phone': 'phone', 'phone number': 'phone', 'mobile': 'phone',
  'address': 'address', 'job address': 'address', 'site address': 'address',
  'suburb': 'suburb', 'city': 'suburb',
  'description': 'description', 'notes': 'description', 'job notes': 'description',
  'category': 'category', 'job type': 'category', 'type': 'category',
  'status': 'status', 'job status': 'status',
  'scheduled date': 'scheduled_date', 'scheduled_date': 'scheduled_date', 'date': 'scheduled_date',
  'system size': 'system_size', 'system_size': 'system_size', 'kw': 'system_size',
  'po number': 'po_number', 'po_number': 'po_number', 'po': 'po_number',
  'value': 'total_value', 'total value': 'total_value', 'total_value': 'total_value', 'amount': 'total_value',
};

function normaliseHeader(h: string): keyof ImportRow | null {
  return HEADER_MAP[h.toLowerCase().trim()] ?? null;
}

function parseRows(raw: Record<string, string>[]): ImportRow[] {
  return raw.map(r => {
    const row: any = {};
    for (const [key, val] of Object.entries(r)) {
      const field = normaliseHeader(key);
      if (field) row[field] = val?.trim() ?? '';
    }
    return row as ImportRow;
  }).filter(r => r.first_name || r.last_name || r.address);
}

function sheetsUrlToCsv(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) return null;
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type Tab = 'file' | 'link';

export function ImportModal({ open, onClose, onImported }: Props) {
  const [tab, setTab] = useState<Tab>('file');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [link, setLink] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]);
    setFileName('');
    setLink('');
    setResult(null);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(res) {
        const parsed = parseRows(res.data as Record<string, string>[]);
        setRows(parsed);
        if (!parsed.length) toast.error('No valid rows found. Check your column headers.');
      },
      error() {
        toast.error('Failed to parse CSV file.');
      },
    });
  }

  async function fetchFromLink() {
    const csvUrl = sheetsUrlToCsv(link);
    if (!csvUrl) {
      toast.error('Invalid Google Sheets URL. Make sure the sheet is publicly shared.');
      return;
    }
    setLinkLoading(true);
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error('Could not fetch sheet. Make sure it is shared publicly (Anyone with the link → Viewer).');
      const text = await res.text();
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete(parsed) {
          const data = parseRows(parsed.data as Record<string, string>[]);
          setRows(data);
          if (!data.length) toast.error('No valid rows found. Check your column headers.');
        },
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch Google Sheet.');
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleImport() {
    if (!rows.length) return;
    setImporting(true);
    try {
      const res = await fetch('/api/jobs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      setResult(data);
      if (data.created > 0) {
        toast.success(`Imported ${data.created} job${data.created !== 1 ? 's' : ''} successfully.`);
        onImported();
      }
      if (data.errors?.length) {
        toast.warning(`${data.errors.length} row(s) had errors.`);
      }
    } catch {
      toast.error('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  const PREVIEW_COLS: { key: keyof ImportRow; label: string }[] = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'category', label: 'Category' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-vision-green" />
            Import Jobs from Spreadsheet
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-light-gray">
          <button
            onClick={() => { setTab('file'); reset(); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'file' ? 'border-vision-green text-vision-green' : 'border-transparent text-mid-gray hover:text-charcoal'}`}
          >
            <Upload className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Upload CSV
          </button>
          <button
            onClick={() => { setTab('link'); reset(); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'link' ? 'border-vision-green text-vision-green' : 'border-transparent text-mid-gray hover:text-charcoal'}`}
          >
            <Link className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Google Sheets Link
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* File upload tab */}
          {tab === 'file' && !rows.length && (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className="border-2 border-dashed border-light-gray rounded-lg p-10 text-center cursor-pointer hover:border-vision-green hover:bg-off-white transition-colors"
            >
              <Upload className="w-10 h-10 mx-auto text-mid-gray mb-3" />
              <p className="text-sm font-medium text-charcoal">Drop your CSV file here or click to browse</p>
              <p className="text-xs text-mid-gray mt-1">Supports .csv files</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {/* Google Sheets tab */}
          {tab === 'link' && !rows.length && (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-dark-gray mb-1">Paste your Google Sheets URL below.</p>
                <p className="text-xs text-mid-gray">The sheet must be shared publicly: <strong>Share → Anyone with the link → Viewer</strong></p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={fetchFromLink} disabled={!link.trim() || linkLoading} className="bg-vision-green hover:bg-vision-green/90 text-white">
                  {linkLoading ? 'Loading…' : 'Load'}
                </Button>
              </div>
              <div className="bg-off-white rounded-lg p-3 text-xs text-dark-gray space-y-1">
                <p className="font-medium">Expected column headers (case-insensitive):</p>
                <p className="text-mid-gray">First Name, Last Name, Email, Phone, Address, Suburb, Description, Category, Status, Scheduled Date, System Size, PO Number, Value</p>
              </div>
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-charcoal">
                  {rows.length} row{rows.length !== 1 ? 's' : ''} ready to import
                  {fileName && <span className="text-mid-gray font-normal ml-1">from {fileName}</span>}
                </p>
                <button onClick={reset} className="text-xs text-mid-gray hover:text-charcoal flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear
                </button>
              </div>
              <div className="overflow-x-auto border border-light-gray rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-off-white border-b border-light-gray">
                    <tr>
                      {PREVIEW_COLS.map(c => (
                        <th key={c.key} className="px-3 py-2 text-left font-medium text-dark-gray">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-light-gray last:border-0">
                        {PREVIEW_COLS.map(c => (
                          <td key={c.key} className="px-3 py-2 text-charcoal truncate max-w-[140px]">{row[c.key] || <span className="text-mid-gray">—</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 10 && (
                  <p className="px-3 py-2 text-xs text-mid-gray bg-off-white border-t border-light-gray">
                    + {rows.length - 10} more rows (all will be imported)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-vision-green shrink-0" />
                <p className="text-sm font-medium text-charcoal">{result.created} job{result.created !== 1 ? 's' : ''} imported successfully</p>
              </div>
              {result.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                    <p className="text-sm font-medium text-charcoal">{result.errors.length} row{result.errors.length !== 1 ? 's' : ''} failed</p>
                  </div>
                  <ul className="ml-6 space-y-0.5">
                    {result.errors.map((e, i) => <li key={i} className="text-xs text-destructive">{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-3 border-t border-light-gray">
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {rows.length > 0 && !result && (
            <Button
              onClick={handleImport}
              disabled={importing}
              className="bg-vision-green hover:bg-vision-green/90 text-white"
            >
              {importing ? 'Importing…' : `Import ${rows.length} Job${rows.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
