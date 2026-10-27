import type { Metadata } from 'next';
import Link from 'next/link';

import { notFoundMetadata } from '@/constants/metadata';

import { Button } from '@/components/ui/button';

export const metadata: Metadata = notFoundMetadata;

export default function NotFound() {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center'>
      <p className='text-primary text-sm font-bold tracking-widest uppercase'>404</p>
      <h1 className='text-3xl font-black tracking-tight'>Nothing here</h1>
      <p className='text-muted-foreground text-sm'>That page doesn&apos;t exist.</p>
      <Button asChild>
        <Link href='/'>Back to your stream</Link>
      </Button>
    </div>
  );
}
