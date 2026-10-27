import { Loader2Icon } from 'lucide-react';

/** Signing in and the like, while it loads: there's no layout worth sketching. */
export function AuthLoading() {
  return (
    <div role='status' aria-busy='true' className='text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-sm'>
      <Loader2Icon className='size-6 animate-spin' aria-hidden='true' />
      Loading…
    </div>
  );
}
