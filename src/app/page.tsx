import type { Metadata } from 'next';
import Link from 'next/link';

import { homeMetadata } from '@/constants/metadata';
import prisma from '@/lib/prisma';
import type { PlatformId } from '@/lib/providers';
import { requireUser } from '@/lib/session';
import { getTwitchChannel, TwitchError } from '@/lib/twitch';

import { PageShell } from '@/components/common/page-shell';
import { SettingsSection } from '@/components/common/settings-section';
import { StreamForm } from '@/components/stream/stream-form';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = homeMetadata;

/** Your stream's title, category and tags, for every platform at once. */
export default async function StreamPage() {
  const { user } = await requireUser();
  const accounts = await prisma.account.findMany({ where: { userId: user.id, providerId: { not: 'credential' } }, select: { providerId: true } });
  // Twitch is the only one Stream can set so far.
  const platforms = (['twitch'] as const satisfies PlatformId[]).filter((id) => accounts.some((account) => account.providerId === id));

  if (!platforms.length) {
    return (
      <StreamShell>
        <div className='bg-card flex flex-col items-start gap-3 rounded-2xl border p-6'>
          <p className='text-sm'>Connect Twitch first, so Stream has somewhere to set it.</p>
          <Button asChild>
            <Link href='/platforms'>Connect a platform</Link>
          </Button>
        </div>
      </StreamShell>
    );
  }

  let channel;
  try {
    channel = await getTwitchChannel(user.id);
  } catch (error) {
    if (!(error instanceof TwitchError)) throw error;
    return (
      <StreamShell>
        <div className='border-destructive/30 bg-destructive/5 flex flex-col items-start gap-3 rounded-2xl border p-6'>
          <p className='text-sm'>{error.message}</p>
          <Button asChild variant='outline'>
            <Link href='/platforms'>Platforms</Link>
          </Button>
        </div>
      </StreamShell>
    );
  }

  return (
    <StreamShell>
      <SettingsSection title='Your stream' description='As it is on Twitch now. Saving sets it everywhere at once.'>
        <StreamForm
          details={channel?.details ?? { title: '', category: null, tags: [], language: 'en', labels: [], brandedContent: false }}
          matureGame={channel?.matureGame ?? false}
          platforms={platforms}
        />
      </SettingsSection>
    </StreamShell>
  );
}

function StreamShell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell eyebrow='Your stream' title='Stream' description='Set what your stream is called, and what it is, on every platform at once.'>
      {children}
    </PageShell>
  );
}
