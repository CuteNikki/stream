import type { Metadata } from 'next';

import { signInMetadata } from '@/constants/metadata';
import { requireSignedOut } from '@/lib/session';

import { AuthShell } from '@/components/auth/auth-shell';
import { SignInForm } from '@/components/auth/sign-in-form';

export const metadata: Metadata = signInMetadata;

export default async function SignInPage() {
  await requireSignedOut();

  return (
    <AuthShell title='Sign in to stream' description='Set what your stream is called, and what it is, everywhere at once.'>
      <SignInForm />
    </AuthShell>
  );
}
