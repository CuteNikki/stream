import type { Metadata } from 'next';

import { platformsMetadata } from '@/constants/metadata';
import { enabledPlatforms } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/session';

import { PageShell } from '@/components/common/page-shell';
import { SettingsSection } from '@/components/common/settings-section';
import { PlatformList } from '@/components/platforms/platform-list';

export const metadata: Metadata = platformsMetadata;

export default async function PlatformsPage({ searchParams }: PageProps<'/platforms'>) {
  const { user } = await requireUser();
  const { error } = await searchParams;
  const accounts = await prisma.account.findMany({ where: { userId: user.id }, select: { id: true, providerId: true } });

  return (
    <PageShell
      eyebrow='Where you stream'
      title='Platforms'
      description='Connect the platforms you stream to, so stream can set your title, category and tags there.'
    >
      <SettingsSection title='Connected platforms'>
        <PlatformList platforms={enabledPlatforms} accounts={accounts} error={typeof error === 'string' ? error : undefined} />
      </SettingsSection>
    </PageShell>
  );
}
