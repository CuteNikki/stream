import 'server-only';

import { accessToken, PlatformError, platformAccount, reconnect } from '@/lib/platform';
import type { Category, StreamDetails } from '@/lib/schemas';

/** The shortest name Kick searches its categories by. */
export const MIN_KICK_SEARCH_LENGTH = 3;

type Account = { id: string; userId: string; providerId: string };

/** Calls Kick's public API as the connected account. */
export async function kickApi<T>(account: Account, path: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(`https://api.kick.com/public/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(account)}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 401) throw reconnect('kick');
  if (!response.ok) {
    const { message } = (await response.json().catch(() => ({}))) as { message?: string };
    console.error(`Kick ${init?.method ?? 'GET'} ${path}: ${response.status} ${message}`);
    throw new PlatformError(message ? `Kick: ${message}` : `Kick didn't answer (${response.status}).`);
  }

  return response.status === 204 ? null : ((await response.json()) as T);
}

type KickCategory = { id: number; name: string; thumbnail: string };

function category(found: KickCategory): Category {
  return { id: String(found.id), name: found.name, boxArt: found.thumbnail };
}

/** The channel as it is on Kick, or null if Kick isn't connected. Its category is its own, as Kick's list isn't Twitch's. */
export async function getKickChannel(userId: string): Promise<{ details: Pick<StreamDetails, 'title' | 'tags' | 'kick'> } | null> {
  const account = await platformAccount(userId, 'kick');
  if (!account) return null;

  // With nothing asked for, Kick answers with the account's own channel
  const channels = await kickApi<{ data: { stream_title: string; category: KickCategory | null; stream: { custom_tags: string[] | null } | null }[] }>(
    account,
    'v1/channels',
  );
  const channel = channels?.data[0];
  if (!channel) throw new PlatformError("Kick didn't find your channel.");

  return {
    details: {
      title: channel.stream_title,
      tags: channel.stream?.custom_tags ?? [],
      kick: { category: channel.category?.id ? category(channel.category) : null },
    },
  };
}

/** Kick's categories matching what's typed. */
export async function searchKickCategories(userId: string, query: string): Promise<Category[]> {
  const account = await platformAccount(userId, 'kick');
  if (!account) throw new PlatformError('Connect Kick to search its categories.');
  if (query.length < MIN_KICK_SEARCH_LENGTH) throw new PlatformError(`Type at least ${MIN_KICK_SEARCH_LENGTH} letters to search Kick.`);

  // Kick finds a name anywhere in a category's, but lists them by id, so the closest go first here
  const results = await kickApi<{ data: KickCategory[] }>(account, `v2/categories?limit=25&name=${encodeURIComponent(query)}`);
  const typed = query.toLowerCase();
  const closeness = (name: string) => (name.toLowerCase() === typed ? 0 : name.toLowerCase().startsWith(typed) ? 1 : 2);
  return (results?.data ?? [])
    .toSorted((a, b) => closeness(a.name) - closeness(b.name))
    .slice(0, 8)
    .map(category);
}

/** Sets the title, tags and category. Kick can't be left without a category, so none keeps the one it has. */
export async function updateKickChannel(userId: string, details: StreamDetails) {
  const account = await platformAccount(userId, 'kick');
  if (!account) throw new PlatformError('Kick is no longer connected.');

  const categoryId = details.kick?.category ? Number(details.kick.category.id) : undefined;
  await kickApi(account, 'v1/channels', {
    method: 'PATCH',
    body: JSON.stringify({ stream_title: details.title, custom_tags: details.tags, category_id: categoryId }),
  });
}
