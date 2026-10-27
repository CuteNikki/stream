import type { Metadata } from 'next';
import Link from 'next/link';

import { homeMetadata } from '@/constants/metadata';
import { PlatformError } from '@/lib/platform';
import prisma from '@/lib/prisma';
import { PLATFORMS } from '@/lib/providers';
import type { StreamDetails } from '@/lib/schemas';
import { requireUser } from '@/lib/session';
import { getTwitchChannel } from '@/lib/twitch';
import { getYouTubeStream } from '@/lib/youtube';

import { PageShell } from '@/components/common/page-shell';
import { SettingsSection } from '@/components/common/settings-section';
import { StreamForm } from '@/components/stream/stream-form';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = homeMetadata;

/** What the form starts from where no platform says otherwise. YouTube's own fields only come from YouTube. */
const EMPTY: StreamDetails = { title: '', category: null, tags: [], language: 'en', labels: [], brandedContent: false };

/** A platform that couldn't be read says why, and the rest still load. */
async function settle<T>(read: Promise<T>) {
  try {
    return { value: await read };
  } catch (error) {
    if (!(error instanceof PlatformError)) throw error;
    return { problem: error.message };
  }
}

/** Your stream's title, category and tags, for every platform at once. */
export default async function StreamPage() {
  const { user } = await requireUser();
  const accounts = await prisma.account.findMany({ where: { userId: user.id }, select: { providerId: true } });
  const platforms = PLATFORMS.map((platform) => platform.id).filter((id) => accounts.some((account) => account.providerId === id));

  if (!platforms.length) {
    return (
      <StreamShell>
        <div className='bg-card flex flex-col items-start gap-3 rounded-2xl border p-6'>
          <p className='text-sm'>Connect a platform first, so Stream has somewhere to set it.</p>
          <Button asChild>
            <Link href='/platforms'>Connect a platform</Link>
          </Button>
        </div>
      </StreamShell>
    );
  }

  const [twitch, youtube] = await Promise.all([settle(getTwitchChannel(user.id)), settle(getYouTubeStream(user.id))]);
  const problems = [twitch.problem, youtube.problem].filter((problem) => problem !== undefined);
  const youtubeStream = youtube.value && youtube.value.broadcast ? youtube.value : null;
  // Twitch's where both have it, as it has more of them; YouTube's own fields are YouTube's.
  const details: StreamDetails = { ...EMPTY, ...youtubeStream?.details, ...twitch.value?.details };
  const source = twitch.value ? 'Twitch' : youtubeStream ? 'YouTube' : null;

  return (
    <StreamShell>
      {!!problems.length && (
        <div className='border-destructive/30 bg-destructive/5 mb-4 flex flex-col items-start gap-3 rounded-2xl border p-4'>
          {problems.map((problem) => (
            <p key={problem} className='text-sm'>
              {problem}
            </p>
          ))}
          <Button asChild variant='outline' size='sm'>
            <Link href='/platforms'>Platforms</Link>
          </Button>
        </div>
      )}
      <SettingsSection
        title='Your stream'
        description={source ? `As it is on ${source} now. Saving sets it everywhere at once.` : 'Saving sets it everywhere at once.'}
      >
        <StreamForm
          details={details}
          matureGame={twitch.value?.matureGame ?? false}
          platforms={platforms}
          youtube={youtube.value ? { broadcast: youtube.value.broadcast } : undefined}
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
