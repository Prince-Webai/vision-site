'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { jobService } from '@/lib/supabase/service';
import { MELBOURNE_COORDS } from '@/lib/constants';
import { geocodeAddress } from '@/lib/geocode';
import type { Job } from '@/lib/types';

const pinIcon = L.divIcon({
  html: `<svg width="22" height="30" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 0C4.9 0 0 4.9 0 11c0 8 11 19 11 19s11-11 11-19C22 4.9 17.1 0 11 0z" fill="#E3A25B" stroke="white" stroke-width="2"/>
    <circle cx="11" cy="10" r="3.5" fill="white"/>
  </svg>`,
  className: '',
  iconSize: [22, 30],
  iconAnchor: [11, 30],
});

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11);
      return;
    }
    map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])), { padding: [20, 20] });
  }, [JSON.stringify(points), map]);
  return null;
}

export function MapPreview() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [coords, setCoords] = useState<Record<string, { lat: number; lng: number }>>({});

  useEffect(() => {
    jobService.fetchJobs().then(setJobs).catch(() => setJobs([]));
  }, []);

  const open = useMemo(
    () => jobs.filter(j => !['Completed', 'Cancelled', 'Unsuccessful'].includes(j.status)),
    [jobs]
  );

  useEffect(() => {
    if (open.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const job of open) {
        if (cancelled) break;
        if (coords[job.id]) continue;
        const c = await geocodeAddress(job.address || '');
        if (c && !cancelled) setCoords(prev => ({ ...prev, [job.id]: c }));
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const pins = open.filter(j => coords[j.id]);

  return (
    <Card
      className="border-light-gray card-hover cursor-pointer group overflow-hidden"
      onClick={() => router.push('/dispatch')}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-charcoal">Job Sites</CardTitle>
          <span className="text-xs text-mid-gray flex items-center gap-1 group-hover:text-vision-green transition-colors">
            Open Dispatch Map
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="relative overflow-hidden rounded-xl border border-light-gray" style={{ height: 208 }}>
          <MapContainer
            center={[MELBOURNE_COORDS.lat, MELBOURNE_COORDS.lng]}
            zoom={6}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={false}
            zoomControl={false}
            dragging={false}
            doubleClickZoom={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds points={pins.map(p => coords[p.id])} />
            {pins.map(j => (
              <Marker key={j.id} position={[coords[j.id].lat, coords[j.id].lng]} icon={pinIcon} />
            ))}
          </MapContainer>

          <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 flex items-center gap-1.5 pointer-events-none">
            <MapPin className="w-3 h-3 text-solar-orange" />
            <span className="text-xs font-medium text-charcoal">
              {pins.length} of {open.length} job{open.length === 1 ? '' : 's'}
            </span>
          </div>

          {open.length === 0 && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 backdrop-blur-sm">
              <p className="text-xs text-mid-gray">No open jobs to show on map</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
