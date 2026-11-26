import { useCallback, useEffect, useState } from 'react';

type Pos = { lat: number; lng: number };
const KEY = 'll_geo';

/** Location is optional (PRD S2): we only ask when the user taps, and remember the answer. */
export function useGeo() {
  const [pos, setPos] = useState<Pos | null>(() => {
    try {
      const v = sessionStorage.getItem(KEY);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<'idle' | 'asking' | 'denied' | 'ok'>(pos ? 'ok' : 'idle');

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) return setStatus('denied');
    setStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const v = { lat: Math.round(p.coords.latitude * 1000) / 1000, lng: Math.round(p.coords.longitude * 1000) / 1000 };
        setPos(v);
        setStatus('ok');
        try {
          sessionStorage.setItem(KEY, JSON.stringify(v));
        } catch {
          /* ignore */
        }
      },
      () => setStatus('denied'),
      { maximumAge: 600_000, timeout: 10_000 },
    );
  }, []);

  useEffect(() => {
    if (pos) return;
    navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((r) => r.state === 'granted' && request()).catch(() => undefined);
  }, [pos, request]);

  return { pos, status, request };
}
