'use client';

import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { jobService } from '@/lib/supabase/service';
import { MELBOURNE_COORDS } from '@/lib/constants';
import { geocodeAddress } from '@/lib/geocode';
import type { Job, StaffLocation } from '@/lib/types';

// Tear-drop SVG markers (no external image needed)
function makeIcon(color: string) {
  const svg = `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="13" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });
}
const jobIcon = makeIcon('#E3A25B');
const staffIcon = makeIcon('#5C8F5A');

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11);
      return;
    }
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [JSON.stringify(points), map]);
  return null;
}

interface JobWithCoords extends Job { coords: { lat: number; lng: number } }

export function DispatchMap({ refreshKey }: { onNewJob?: () => void; refreshKey?: number }) {
  const [staffLocations, setStaffLocations] = useState<StaffLocation[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [coords, setCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [j, s] = await Promise.all([jobService.fetchJobs(), jobService.fetchStaffLocations()]);
        setJobs(j);
        setStaffLocations(s as StaffLocation[]);
      } catch (e: any) { console.error('Failed to load map data:', e?.message || e); }
    })();
  }, [refreshKey]);

  const visibleJobs = useMemo(
    () => jobs.filter(j => !['Completed', 'Cancelled', 'Unsuccessful'].includes(j.status)),
    [jobs]
  );

  useEffect(() => {
    if (visibleJobs.length === 0) return;
    let cancelled = false;
    (async () => {
      setGeocoding(true);
      for (const job of visibleJobs) {
        if (cancelled) break;
        if (coords[job.id]) continue;
        const c = await geocodeAddress(job.address || '');
        if (c && !cancelled) setCoords(prev => ({ ...prev, [job.id]: c }));
      }
      if (!cancelled) setGeocoding(false);
    })();
    return () => { cancelled = true; };
  }, [visibleJobs]);

  const jobsWithCoords: JobWithCoords[] = visibleJobs
    .filter(j => coords[j.id])
    .map(j => ({ ...j, coords: coords[j.id] }));

  const allPoints = [
    ...jobsWithCoords.map(j => j.coords),
    ...staffLocations.map(s => ({ lat: Number(s.latitude), lng: Number(s.longitude) })),
  ];

  return (
    <div className="flex-1 relative h-full min-w-0">
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[MELBOURNE_COORDS.lat, MELBOURNE_COORDS.lng]}
          zoom={7}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={allPoints} />

          {staffLocations.map(loc => (
            <Marker key={loc.id} position={[Number(loc.latitude), Number(loc.longitude)]} icon={staffIcon}>
              <Popup>
                <strong>{loc.profile?.full_name}</strong>
                <br />
                <span style={{ color: '#6b7280', fontSize: 11 }}>{loc.profile?.status}</span>
              </Popup>
            </Marker>
          ))}

          {jobsWithCoords.map(job => (
            <Marker key={job.id} position={[job.coords.lat, job.coords.lng]} icon={jobIcon}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <strong>{job.job_number}</strong>
                  <br />
                  <span style={{ color: '#374151', fontSize: 12 }}>
                    {job.contact_name || (job.client ? `${job.client.first_name} ${job.client.last_name}` : '—')}
                  </span>
                  <br />
                  <span style={{ color: '#6b7280', fontSize: 11 }}>{job.address}</span>
                  <br />
                  <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 6px', borderRadius: 4, background: '#fff7ed', color: '#9a3412', fontSize: 10, fontWeight: 500 }}>{job.status}</span>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg border border-light-gray px-3 py-1.5 shadow-sm">
        <p className="text-xs text-charcoal">
          {geocoding && <span className="text-mid-gray">Locating… </span>}
          <span className="font-semibold">{jobsWithCoords.length}</span>
          <span className="text-mid-gray"> / {visibleJobs.length} jobs on map</span>
        </p>
      </div>

      <div className="absolute bottom-6 left-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg border border-light-gray p-3 shadow-sm">
        <p className="text-xs font-semibold text-charcoal mb-2">Legend</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-vision-green border border-white shadow-sm" />
            <span className="text-xs text-dark-gray">Staff Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-solar-orange border border-white shadow-sm" />
            <span className="text-xs text-dark-gray">Job Site</span>
          </div>
        </div>
      </div>
    </div>
  );
}
