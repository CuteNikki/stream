import { cn } from '@/lib/utils';

/** A card of settings or details, with a title and a line about it. */
export function SettingsSection({
  title,
  description,
  destructive,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  destructive?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn('rounded-2xl border p-4', destructive ? 'border-destructive/30 bg-destructive/5' : 'border-foreground/10 bg-card shadow-sm', className)}
    >
      <div className='mb-4'>
        <h2 className={cn('text-xl font-bold', destructive && 'text-destructive')}>{title}</h2>
        {description && <p className='text-muted-foreground mt-1 text-sm text-pretty'>{description}</p>}
      </div>
      {children}
    </section>
  );
}
