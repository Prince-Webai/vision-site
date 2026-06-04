import { useEffect, useState } from 'react';

/**
 * Returns true on mobile (< 768px), false on desktop, undefined during SSR.
 * Uses 768px to match Tailwind's `md` breakpoint.
 */
export function useIsMobile(): boolean | undefined {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}
