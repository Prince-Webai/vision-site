// Geocode addresses with a persistent (localStorage) cache so each unique
// address only hits Nominatim ONCE — even across reloads.

const STORAGE_KEY = 'visionsolar_geocode_cache_v1';

type Cache = Record<string, { lat: number; lng: number } | null>;

let memCache: Cache | null = null;
let inflight: Record<string, Promise<{ lat: number; lng: number } | null>> = {};

function loadCache(): Cache {
  if (memCache) return memCache;
  if (typeof window === 'undefined') return (memCache = {});
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    memCache = raw ? JSON.parse(raw) : {};
  } catch {
    memCache = {};
  }
  return memCache!;
}

function saveCache(c: Cache) {
  memCache = c;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {/* quota or disabled */}
}

const norm = (a: string) => a.trim().toLowerCase().replace(/\s+/g, ' ');

export function readGeocodeFromCache(address: string) {
  if (!address?.trim()) return undefined;
  return loadCache()[norm(address)];
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address?.trim()) return null;
  const key = norm(address);
  const cache = loadCache();
  if (key in cache) return cache[key];
  if (inflight[key]) return inflight[key];

  inflight[key] = (async () => {
    try {
      // Try the last token (likely Eircode/town) first, then full address.
      const tokens = address.trim().split(/[\s,]+/).filter(Boolean);
      const tries = [address.trim()];
      if (tokens.length > 1) tries.unshift(tokens.slice(-2).join(' '));

      for (const q of tries) {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ie&limit=1&q=${encodeURIComponent(q)}`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const coord = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          cache[key] = coord;
          saveCache(cache);
          return coord;
        }
      }
      cache[key] = null;
      saveCache(cache);
      return null;
    } catch {
      cache[key] = null;
      saveCache(cache);
      return null;
    } finally {
      delete inflight[key];
    }
  })();

  return inflight[key];
}

export function clearGeocodeCache() {
  memCache = {};
  if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}
