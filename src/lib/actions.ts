'use server';

import { isAPIError } from 'better-auth/api';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { auth, forgetTrustedDevices as forget } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateNameSchema } from '@/lib/schemas';
import { getSession, requireUser } from '@/lib/session';

export async function logOut() {
  await auth.api.signOut({ headers: await headers() });

  redirect('/sign-in');
}

export async function updateName(unsafeData: z.infer<typeof updateNameSchema>) {
  const { success, data } = updateNameSchema.safeParse(unsafeData);

  if (!success) return { message: 'Unable to update your name!' };

  const session = await requireUser();

  if (session.user.name === data.name) return { message: 'That is already your name.' };

  try {
    await auth.api.updateUser({ body: { name: data.name }, headers: await headers() });
  } catch (error) {
    console.error(error);
    return { message: 'Unable to update your name!' };
  }

  revalidatePath('/settings');
}

export async function forgetTrustedDevices() {
  const session = await getSession();
  if (!session) return { message: 'You are not signed in.' };

  await forget(session.user.id);

  revalidatePath('/settings');
}

export async function revokeOtherSessions() {
  await auth.api.revokeOtherSessions({ headers: await headers() });

  revalidatePath('/settings');
}

export async function revokeSession(sessionId: string) {
  const session = await getSession();
  if (!session) return { message: 'You are not signed in.' };

  // Looked up by id, so session tokens never have to be sent to the browser.
  const target = await prisma.session.findFirst({ where: { id: sessionId, userId: session.user.id } });
  if (!target) return { message: 'That session has already ended.' };

  await auth.api.revokeSession({ body: { token: target.token }, headers: await headers() });

  revalidatePath('/settings');
}

export async function setPassword(newPassword: string) {
  try {
    await auth.api.setPassword({ body: { newPassword }, headers: await headers() });
  } catch (error) {
    if (isAPIError(error)) return { message: error.message };
    console.error(error);
    return { message: 'Unable to add a password!' };
  }

  revalidatePath('/settings');
}
