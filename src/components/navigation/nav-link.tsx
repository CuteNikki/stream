'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/** A page in the navbar, marked while it's the one open. On phones it's only its icon, so every page fits. */
export function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const pathname = usePathname();
  const current = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        current ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span className='sm:hidden' title={label}>
        {icon}
      </span>
      <span className='sr-only sm:not-sr-only'>{label}</span>
    </Link>
  );
}
