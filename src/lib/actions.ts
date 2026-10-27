'use server';

import { isAPIError } from 'better-auth/api';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { auth, forgetTrustedDevices as forget } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { PlatformError } from '@/lib/platform';
import { PLATFORMS, providerLabel, type PlatformId } from '@/lib/providers';
import { streamSchema, updateNameSchema, type Category, type StreamDetails } from '@/lib/schemas';
import { getSession, requireUser } from '@/lib/session';
import { searchTwitchCategories, updateTwitchChannel } from '@/lib/twitch';
import { updateYouTubeStream } from '@/lib/youtube';

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

/** Twitch's categories for the category picker. */
export async function searchCategories(query: string): Promise<{ categories: Category[] } | { message: string }> {
  const session = await getSession();
  if (!session) return { message: 'You are not signed in.' };

  const typed = query.trim().slice(0, 100);
  if (!typed) return { categories: [] };

  try {
    return { categories: await searchTwitchCategories(session.user.id, typed) };
  } catch (error) {
    if (error instanceof PlatformError) return { message: error.message };
    console.error(error);
    return { message: 'Unable to search categories!' };
  }
}

/** How saving went on one platform. */
export type PlatformResult = { platform: PlatformId; ok: true } | { platform: PlatformId; ok: false; message: string };

/**
 * Sets the stream's details on every connected platform. Each goes on its own, so one failing
 * doesn't stop the others; the results say how each went.
 */
export async function updateStream(unsafeData: StreamDetails): Promise<{ results: PlatformResult[] } | { message: string }> {
  const { success, data } = streamSchema.safeParse(unsafeData);
  if (!success) return { message: 'Unable to update your stream!' };

  const session = await getSession();
  if (!session) return { message: 'You are not signed in.' };

  const connected = await prisma.account.findMany({ where: { userId: session.user.id }, select: { providerId: true } });
  const updates: Record<PlatformId, () => Promise<void>> = {
    twitch: () => updateTwitchChannel(session.user.id, data),
    google: () => updateYouTubeStream(session.user.id, data),
  };

  const platforms = PLATFORMS.map((platform) => platform.id).filter((id) => connected.some((account) => account.providerId === id));
  if (!platforms.length) return { message: 'Connect a platform first.' };

  const results = await Promise.all(
    platforms.map(async (platform): Promise<PlatformResult> => {
      try {
        await updates[platform]();
        return { platform, ok: true };
      } catch (error) {
        if (!(error instanceof PlatformError)) console.error(error);
        return { platform, ok: false, message: error instanceof PlatformError ? error.message : `Unable to update ${providerLabel(platform)}!` };
      }
    }),
  );

  revalidatePath('/');
  return { results };
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
