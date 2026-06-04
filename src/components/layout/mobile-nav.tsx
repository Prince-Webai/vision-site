'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MapPin,
  Clock,
  Clock4,
  Menu,
  LogOut,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Dispatch Board', href: '/dispatch', icon: MapPin },
  { label: 'Timesheets', href: '/timesheets', icon: Clock4 },
  { label: 'History', href: '/history', icon: Clock },
];

interface MobileNavProps {
  currentUser: { full_name: string; role: string } | null;
}

export function MobileNav({ currentUser }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Hamburger trigger button — mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-mid-gray hover:bg-off-white hover:text-charcoal transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={true} className="p-0 w-[260px] flex flex-col bg-white">
          {/* Logo */}
          <div className="flex items-center px-4 h-16 shrink-0">
            <Image
              src="/images/logo.svg"
              alt="VisionSolar"
              width={150}
              height={38}
              priority
            />
          </div>

          <Separator className="bg-light-gray" />

          {/* Nav Items */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-200 relative
                    ${isActive
                      ? 'bg-accent text-green-dark'
                      : 'text-dark-gray hover:bg-off-white hover:text-charcoal'
                    }
                  `}
                  onClick={() => setOpen(false)}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-vision-green" />
                  )}
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-vision-green' : 'text-mid-gray'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Separator className="bg-light-gray" />

          {/* User Section */}
          <div className="p-3 shrink-0">
            <div className="flex items-center gap-3">
              <Avatar className="w-9 h-9 shrink-0 border-2 border-green-light/30">
                <AvatarFallback className="bg-vision-green text-white text-xs font-semibold">
                  {currentUser?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-charcoal truncate">{currentUser?.full_name || 'Loading…'}</p>
                <p className="text-xs text-mid-gray truncate">{currentUser?.role || ''}</p>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-mid-gray hover:text-destructive hover:bg-red-50 shrink-0 transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
