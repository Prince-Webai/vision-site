'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MapPin, Clock4, Clock } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Dispatch',  href: '/dispatch',  icon: MapPin },
  { label: 'Timesheets',href: '/timesheets', icon: Clock4 },
  { label: 'History',   href: '/history',   icon: Clock },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-light-gray flex safe-area-pb">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
              isActive ? 'text-vision-green' : 'text-mid-gray hover:text-dark-gray'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-vision-green' : 'text-mid-gray'}`}>
              {label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 w-8 h-[2.5px] rounded-t-full bg-vision-green" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
