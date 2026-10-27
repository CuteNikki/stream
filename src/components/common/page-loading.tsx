import { PageShell } from '@/components/common/page-shell';

/** A page while it loads: its header as it will be, and placeholders shaped like the rest (see skeletons). */
export function PageLoading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <PageShell eyebrow={eyebrow} title={title} description={description}>
      <div aria-busy='true' aria-label='Loading'>
        {children}
      </div>
    </PageShell>
  );
}
