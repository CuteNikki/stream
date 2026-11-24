import type { Metadata } from 'next';
import Link from 'next/link';

import { chatMetadata } from '@/constants/metadata';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/session';

import { ChatView } from '@/components/chat/chat-view';
import { PageShell } from '@/components/common/page-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = chatMetadata;

/** Every platform's chat, live, to read one at a time or all together, and to write in. */
export default async function ChatPage() {
  const { user } = await requireUser();
  const connected = await prisma.account.count({ where: { userId: user.id, providerId: { not: 'credential' } } });

  return (
    <ChatShell>
      {connected ? (
        <ChatView />
      ) : (
        <div className='bg-card flex flex-col items-start gap-3 rounded-2xl border p-6'>
          <p className='text-sm'>Connect a platform first, so Stream has a chat to show.</p>
          <Button asChild>
            <Link href='/platforms'>Connect a platform</Link>
          </Button>
        </div>
      )}
    </ChatShell>
  );
}

function ChatShell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell eyebrow='Your chat' title='Chat' description="Every platform's chat as it happens: together, side by side, or one at a time." fill>
      {children}
    </PageShell>
  );
}
