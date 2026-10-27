import 'server-only';

import prisma from '@/lib/prisma';

/**
 * Whether the one account stream has exists yet. Until it does, the first
 * visit sets it up (see app/setup); after, nobody else can make one, however
 * they try (see lib/auth.ts).
 */
export async function hasOwner() {
  return (await prisma.user.count()) > 0;
}
