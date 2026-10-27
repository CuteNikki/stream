import 'server-only';

import { LANGUAGES, MAX_YOUTUBE_TITLE_LENGTH, YOUTUBE_CATEGORIES } from '@/constants/stream';
import { accessToken, PlatformError, platformAccount, reconnect } from '@/lib/platform';
import { tagSchema, type StreamDetails } from '@/lib/schemas';

type Broadcast = {
  id: string;
  snippet: { title: string; scheduledStartTime?: string };
  contentDetails: { boundStreamId?: string };
};

type Video = {
  snippet: { title: string; description: string; categoryId: string; tags?: string[]; defaultLanguage?: string; defaultAudioLanguage?: string };
  paidProductPlacementDetails?: { hasPaidProductPlacement: boolean };
};

/** The broadcast Stream sets, as shown with the form. */
export type YouTubeBroadcast = { title: string; live: boolean };

/** Calls the YouTube Data API as the connected account. */
async function youtube<T>(account: { id: string; providerId: string }, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(account)}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 401) throw reconnect('google');
  if (!response.ok) {
    const { error } = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    console.error(`YouTube ${init?.method ?? 'GET'} ${path}: ${response.status} ${error?.message}`);
    throw new PlatformError(error?.message ? `YouTube: ${error.message}` : `YouTube didn't answer (${response.status}).`);
  }

  return (await response.json()) as T;
}

/**
 * The broadcast Stream sets: the one that's live, or else the next one coming. Among those, the one bound to a
 * stream key first, as that's where going live in OBS lands; then the soonest.
 */
async function currentBroadcast(account: { id: string; providerId: string }) {
  const list = (status: string) =>
    youtube<{ items: Broadcast[] }>(account, `liveBroadcasts?part=snippet,contentDetails&broadcastStatus=${status}&maxResults=50`);
  const [active, upcoming] = await Promise.all([list('active'), list('upcoming')]);
  if (active.items[0]) return { broadcast: active.items[0], live: true };

  const next = upcoming.items.toSorted(
    (a, b) =>
      Number(!a.contentDetails.boundStreamId) - Number(!b.contentDetails.boundStreamId) ||
      (a.snippet.scheduledStartTime ?? '').localeCompare(b.snippet.scheduledStartTime ?? ''),
  )[0];
  return next ? { broadcast: next, live: false } : null;
}

async function video(account: { id: string; providerId: string }, id: string) {
  const { items } = await youtube<{ items: Video[] }>(account, `videos?part=snippet,paidProductPlacementDetails&id=${id}`);
  if (!items[0]) throw new PlatformError("YouTube didn't find the broadcast's video.");
  return items[0];
}

/**
 * The broadcast Stream would set and what it's set to, or null if YouTube isn't connected. Without a broadcast,
 * there's nothing to read or set.
 */
export async function getYouTubeStream(
  userId: string,
): Promise<{ broadcast: YouTubeBroadcast; details: Omit<StreamDetails, 'category' | 'labels'> } | { broadcast: null } | null> {
  const account = await platformAccount(userId, 'google');
  if (!account) return null;

  const current = await currentBroadcast(account);
  if (!current) return { broadcast: null };

  const { snippet, paidProductPlacementDetails } = await video(account, current.broadcast.id);
  // YouTube's languages can be regional (en-GB) and its tags can have spaces, which Twitch's can't.
  const language = snippet.defaultAudioLanguage?.split('-')[0].toLowerCase();
  return {
    broadcast: { title: current.broadcast.snippet.title, live: current.live },
    details: {
      title: snippet.title,
      tags: (snippet.tags ?? []).filter((tag) => tagSchema.safeParse(tag).success),
      language: LANGUAGES.some((known) => known.code === language) ? language! : 'other',
      brandedContent: paidProductPlacementDetails?.hasPaidProductPlacement ?? false,
      youtubeCategory: YOUTUBE_CATEGORIES.find((category) => category.id === snippet.categoryId)?.id ?? '20',
    },
  };
}

/**
 * Sets the broadcast's title, category, tags, language and paid promotion. Everything else on it, like its
 * description, stays as it is: YouTube clears what an update leaves out, so it's sent back as it was.
 */
export async function updateYouTubeStream(userId: string, details: StreamDetails) {
  if (details.title.length > MAX_YOUTUBE_TITLE_LENGTH) throw new PlatformError(`YouTube titles can be at most ${MAX_YOUTUBE_TITLE_LENGTH} characters.`);
  if (/[<>]/.test(details.title)) throw new PlatformError("YouTube titles can't have < or >.");

  const account = await platformAccount(userId, 'google');
  if (!account) throw new PlatformError('YouTube is no longer connected.');

  const current = await currentBroadcast(account);
  if (!current) throw new PlatformError("There's no stream coming up on YouTube to set. Open Go live in YouTube Studio once, and it makes one.");

  const { snippet, paidProductPlacementDetails } = await video(account, current.broadcast.id);
  await youtube(account, 'videos?part=snippet', {
    method: 'PUT',
    body: JSON.stringify({
      id: current.broadcast.id,
      snippet: {
        title: details.title,
        description: snippet.description,
        categoryId: details.youtubeCategory,
        tags: details.tags,
        defaultLanguage: snippet.defaultLanguage,
        // "Other" isn't a language YouTube knows, so it leaves the one there
        defaultAudioLanguage: details.language === 'other' ? snippet.defaultAudioLanguage : details.language,
      },
    }),
  });

  // On its own, and only when it changes, so the rest goes through even where YouTube won't take it.
  if (details.brandedContent !== (paidProductPlacementDetails?.hasPaidProductPlacement ?? false)) {
    await youtube(account, 'videos?part=paidProductPlacementDetails', {
      method: 'PUT',
      body: JSON.stringify({ id: current.broadcast.id, paidProductPlacementDetails: { hasPaidProductPlacement: details.brandedContent } }),
    });
  }
}
