import { cn } from '@/lib/utils';

import { Eyebrow, PageNote, PageTitle } from '@/components/common/heading';

/**
 * A page past signing in: its label, title and a line about it, then what's on it. With `fill`, it's exactly as
 * tall as the window under the navbar, and what's on it takes the height left, like the chat's feed.
 */
export function PageShell({
  eyebrow,
  title,
  description,
  fill,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    // A fixed height, not flex-1, whose basis would win over the height and let it grow with what's in it
    <div className={cn('flex flex-col px-4 py-10 sm:px-6', fill ? 'h-[calc(100dvh-var(--spacing-navbar))]' : 'flex-1')}>
      <div className={cn('container mx-auto max-w-5xl', fill && 'flex min-h-0 flex-1 flex-col')}>
        <header className='mb-8'>
          <Eyebrow>{eyebrow}</Eyebrow>
          <PageTitle>{title}</PageTitle>
          {description && <PageNote>{description}</PageNote>}
        </header>
        {children}
      </div>
    </div>
  );
}
