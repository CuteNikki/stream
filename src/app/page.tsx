import type { Metadata } from 'next';
import Link from 'next/link';

import { homeMetadata } from '@/constants/metadata';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/session';

import { PageShell } from '@/components/common/page-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = homeMetadata;

/** Your stream's title, category and tags, for every platform at once. */
export default async function StreamPage() {
  const { user } = await requireUser();
  const platforms = await prisma.account.count({ where: { userId: user.id, providerId: { not: 'credential' } } });

  return (
    <PageShell eyebrow='Your stream' title='Stream' description='Set what your stream is called, and what it is, on every platform at once.'>
      {platforms === 0 && (
        <div className='bg-card flex flex-col items-start gap-3 rounded-2xl border p-6'>
          <p className='text-sm'>Connect a platform first, so Stream has somewhere to set it.</p>
          <Button asChild>
            <Link href='/platforms'>Connect a platform</Link>
          </Button>
        </div>
      )}
    </PageShell>
  );
}
