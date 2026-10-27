import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { setupMetadata } from '@/constants/metadata';
import { hasOwner } from '@/lib/setup';

import { AuthShell } from '@/components/auth/auth-shell';
import { SetupForm } from '@/components/auth/setup-form';

export const metadata: Metadata = setupMetadata;

/** The first visit: making the one account. Once it's there, this is only a way to sign in. */
export default async function SetupPage() {
  if (await hasOwner()) redirect('/sign-in');

  return (
    <AuthShell title='Set up stream' description="Make the account you'll sign in with. It's the only one: once it's made, nobody else can make another.">
      <SetupForm />
    </AuthShell>
  );
}
