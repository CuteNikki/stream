import { Enter } from '@/components/common/enter';
import { Logo } from '@/components/common/logo';
import { Card, CardContent } from '@/components/ui/card';

/** Signing in, setting up and the like: the logo, a title, and the form on a card. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className='flex flex-1 items-center justify-center px-4 py-16'>
      <div className='flex w-full max-w-md flex-col items-center'>
        <Enter variant='pop' delay={0.05}>
          <Logo className='mb-6 size-10' />
        </Enter>

        <Enter variant='sink' delay={0.15}>
          <h1 className='text-center text-3xl leading-none font-black tracking-tight'>{title}</h1>
        </Enter>

        <Enter variant='sink' delay={0.25}>
          <p className='text-muted-foreground mt-3 max-w-sm text-center text-sm leading-relaxed text-balance'>{description}</p>
        </Enter>

        <Enter variant='reveal' delay={0.35} className='mt-8 w-full'>
          <Card className='shadow-lg'>
            <CardContent className='pt-2'>{children}</CardContent>
          </Card>
        </Enter>

        {footer && (
          <Enter variant='reveal' delay={0.45} className='mt-6'>
            {footer}
          </Enter>
        )}
      </div>
    </div>
  );
}
