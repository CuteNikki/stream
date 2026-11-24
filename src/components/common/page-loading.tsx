import { cn } from '@/lib/utils';

import { PageShell } from '@/components/common/page-shell';

/** A page while it loads: its header as it will be, and placeholders shaped like the rest (see skeletons). */
export function PageLoading({
  eyebrow,
  title,
  description,
  fill,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  /** As the page's own PageShell has it. */
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <PageShell eyebrow={eyebrow} title={title} description={description} fill={fill}>
      <div aria-busy='true' aria-label='Loading' className={cn(fill && 'flex min-h-0 flex-1 flex-col')}>
        {children}
      </div>
    </PageShell>
  );
}
