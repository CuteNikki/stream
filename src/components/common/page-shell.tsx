import { Eyebrow, PageNote, PageTitle } from '@/components/common/heading';

/** A page past signing in: its label, title and a line about it, then what's on it. */
export function PageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className='flex flex-1 flex-col px-4 py-10 sm:px-6'>
      <div className='container mx-auto max-w-5xl'>
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
