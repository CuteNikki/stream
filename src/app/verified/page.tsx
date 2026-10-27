import type { Metadata } from 'next';
import Link from 'next/link';

import { verifiedMetadata } from '@/constants/metadata';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = verifiedMetadata;

const messages = {
  // A new account's address, or a resent link.
  verified: {
    title: 'Email verified',
    text: 'Thanks! Your email address is confirmed.',
  },
  // Changing email, step 1: confirmed from the old address.
  confirmed: {
    title: 'Check your new inbox',
    text: 'We sent one more link to your new address. Open it to finish changing your email.',
  },
  // Changing email, step 2: confirmed from the new address.
  changed: {
    title: 'Email changed',
    text: 'Your new email address is confirmed and now in use.',
  },
};

/** Where the links in verification and email change emails land. */
export default async function VerifiedPage({ searchParams }: PageProps<'/verified'>) {
  const { error, step } = await searchParams;

  if (error) {
    return (
      <AuthShell
        title="That link didn't work"
        description={`${error === 'TOKEN_EXPIRED' ? 'It has expired. Links work for 24 hours.' : 'It is invalid or was already used.'} Sign in and try again from settings.`}
      >
        <Button asChild className='w-full'>
          <Link href='/settings'>Go to settings</Link>
        </Button>
      </AuthShell>
    );
  }

  const message = step === 'confirmed' || step === 'changed' ? messages[step] : messages.verified;

  return (
    <AuthShell title={message.title} description={message.text}>
      <Button asChild className='w-full'>
        <Link href={step ? '/settings' : '/'}>{step ? 'Go to settings' : 'Go to your stream'}</Link>
      </Button>
    </AuthShell>
  );
}
