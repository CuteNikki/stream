import 'server-only';

import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { providerLabel, type PlatformId } from '@/lib/providers';

/** Something a platform turned away, with a message fit to show. */
export class PlatformError extends Error {}

/** A connected platform's account: its row, for its token, and its id there. */
export async function platformAccount(userId: string, platform: PlatformId) {
  return prisma.account.findFirst({ where: { userId, providerId: platform }, select: { id: true, accountId: true, providerId: true } });
}

/** The account's access token, refreshed first if it has run out. */
export async function accessToken(account: { id: string; providerId: string }) {
  try {
    const { accessToken } = await auth.api.getAccessToken({ body: { accountId: account.id }, headers: await headers() });
    return accessToken;
  } catch (error) {
    console.error(error);
    throw reconnect(account.providerId);
  }
}

/** For a token the platform no longer takes, e.g. when Stream's access was removed there. */
export function reconnect(platform: string) {
  return new PlatformError(`${providerLabel(platform)} needs connecting again, on the platforms page.`);
}
