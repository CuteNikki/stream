import Link from 'next/link';

import { getSession } from '@/lib/session';

import { LogOutButton } from '@/components/auth/logout-button';
import { Logo } from '@/components/common/logo';
import { NavLink } from '@/components/navigation/nav-link';
import { ThemeButton } from '@/components/theme/switch';

const LINKS = [
  { href: '/', label: 'Stream' },
  { href: '/platforms', label: 'Platforms' },
  { href: '/settings', label: 'Settings' },
];

/** Across the top: the pages, once signed in, and the theme either way. */
export async function Navbar() {
  const session = await getSession();

  return (
    <header className='bg-background/80 sticky top-0 z-40 border-b backdrop-blur'>
      <nav className='container mx-auto flex h-14 max-w-5xl items-center gap-1 px-4 sm:px-6'>
        <Link href='/' className='mr-3 flex items-center gap-2 font-bold tracking-tight'>
          <Logo className='size-7' />
          Stream
        </Link>
        {session && LINKS.map((link) => <NavLink key={link.href} {...link} />)}
        <div className='ml-auto flex items-center gap-1'>
          <ThemeButton />
          {session && <LogOutButton className='hidden sm:inline-flex' variant='ghost' />}
        </div>
      </nav>
    </header>
  );
}

/** While the session is looked up: the same bar, without what depends on it. */
export function NavbarFallback() {
  return (
    <header className='bg-background/80 sticky top-0 z-40 border-b backdrop-blur'>
      <nav className='container mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6'>
        <span className='flex items-center gap-2 font-bold tracking-tight'>
          <Logo className='size-7' />
          Stream
        </span>
      </nav>
    </header>
  );
}
