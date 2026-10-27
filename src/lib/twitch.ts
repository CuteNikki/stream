import 'server-only';

import { headers } from 'next/headers';

import { CONTENT_LABELS, type ContentLabel } from '@/constants/stream';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import type { Category, StreamDetails } from '@/lib/schemas';

/** Something Twitch turned away, with a message fit to show. */
export class TwitchError extends Error {}

/** Box art twice the size it's shown at (52x72), for sharp screens. */
function boxArt(url: string) {
  return url.replace('{width}x{height}', '104x144').replace(/-\d+x\d+\./, '-104x144.');
}

/** The connected Twitch account: its row, for its token, and the channel's id. */
async function twitchAccount(userId: string) {
  return prisma.account.findFirst({ where: { userId, providerId: 'twitch' }, select: { id: true, accountId: true } });
}

/** Calls Helix as the connected account, its token refreshed first if it has run out. */
async function helix<T>(account: { id: string }, path: string, init?: RequestInit): Promise<T | null> {
  const { accessToken } = await auth.api.getAccessToken({ body: { accountId: account.id }, headers: await headers() }).catch((error) => {
    console.error(error);
    throw new TwitchError('Twitch needs connecting again, on the platforms page.');
  });

  const response = await fetch(`https://api.twitch.tv/helix/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Client-Id': process.env.TWITCH_CLIENT_ID!, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 401) throw new TwitchError('Twitch needs connecting again, on the platforms page.');
  if (!response.ok) {
    const { message } = (await response.json().catch(() => ({}))) as { message?: string };
    console.error(`Twitch ${init?.method ?? 'GET'} ${path}: ${response.status} ${message}`);
    throw new TwitchError(message ? `Twitch: ${message}` : `Twitch didn't answer (${response.status}).`);
  }

  return response.status === 204 ? null : ((await response.json()) as T);
}

/** The channel as it is on Twitch, or null if Twitch isn't connected. */
export async function getTwitchChannel(userId: string): Promise<{ details: StreamDetails; matureGame: boolean } | null> {
  const account = await twitchAccount(userId);
  if (!account) return null;

  const channels = await helix<{
    data: {
      title: string;
      game_id: string;
      game_name: string;
      tags: string[];
      broadcaster_language: string;
      content_classification_labels: string[];
      is_branded_content: boolean;
    }[];
  }>(account, `channels?broadcaster_id=${account.accountId}`);
  const channel = channels?.data[0];
  if (!channel) throw new TwitchError("Twitch didn't find your channel.");

  // The channel only names its category; the box art comes from the game itself.
  let category: Category | null = null;
  if (channel.game_id) {
    const games = await helix<{ data: { box_art_url: string }[] }>(account, `games?id=${channel.game_id}`);
    category = { id: channel.game_id, name: channel.game_name, boxArt: boxArt(games?.data[0]?.box_art_url ?? '') };
  }

  const settable = new Set<string>(CONTENT_LABELS.map((label) => label.id));
  return {
    details: {
      title: channel.title,
      category,
      tags: channel.tags,
      language: channel.broadcaster_language || 'other',
      labels: channel.content_classification_labels.filter((label): label is ContentLabel => settable.has(label)),
      brandedContent: channel.is_branded_content,
    },
    matureGame: channel.content_classification_labels.includes('MatureGame'),
  };
}

/** Twitch's categories matching what's typed, best first. */
export async function searchTwitchCategories(userId: string, query: string): Promise<Category[]> {
  const account = await twitchAccount(userId);
  if (!account) throw new TwitchError('Connect Twitch to search its categories.');

  const results = await helix<{ data: { id: string; name: string; box_art_url: string }[] }>(
    account,
    `search/categories?first=8&query=${encodeURIComponent(query)}`,
  );
  return (results?.data ?? []).map((game) => ({ id: game.id, name: game.name, boxArt: boxArt(game.box_art_url) }));
}

/** Sets everything on the channel. No category clears it, and each label is turned on or off. */
export async function updateTwitchChannel(userId: string, details: StreamDetails) {
  const account = await twitchAccount(userId);
  if (!account) throw new TwitchError('Twitch is no longer connected.');

  await helix(account, `channels?broadcaster_id=${account.accountId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: details.title,
      game_id: details.category?.id ?? '',
      tags: details.tags,
      broadcaster_language: details.language,
      content_classification_labels: CONTENT_LABELS.map((label) => ({ id: label.id, is_enabled: details.labels.includes(label.id) })),
      is_branded_content: details.brandedContent,
    }),
  });
}
