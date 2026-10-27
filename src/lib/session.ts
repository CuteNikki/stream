import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';

import { auth } from '@/lib/auth';
import { hasOwner } from '@/lib/setup';

/**
 * The signed-in session, looked up once per request however often asked.
 * Never prerendered: checking a session, and
 * what's shown with it, goes by the clock.
 */
export const getSession = cache(async () => {
  await connection();
  return auth.api.getSession({ headers: await headers() });
});

/** Redirects to sign in if signed out, or to set up the account if there's none yet. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect((await hasOwner()) ? '/sign-in' : '/setup');
  return session;
}

/** Redirects home if already signed in, e.g. on sign-in pages, and to setup if there's no account to sign in to. */
export async function requireSignedOut() {
  if (await getSession()) redirect('/');
  if (!(await hasOwner())) redirect('/setup');
}
