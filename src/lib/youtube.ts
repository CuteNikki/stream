import 'server-only';

import { LANGUAGES, MAX_YOUTUBE_TITLE_LENGTH, YOUTUBE_CATEGORIES, YOUTUBE_VISIBILITIES } from '@/constants/stream';
import { accessToken, PlatformError, platformAccount, reconnect } from '@/lib/platform';
import { tagSchema, type StreamDetails } from '@/lib/schemas';

type Account = { id: string; providerId: string };

type Broadcast = {
  id: string;
  snippet: { title: string; scheduledStartTime?: string };
  contentDetails: { boundStreamId?: string };
};

type Thumbnails = Partial<Record<'default' | 'medium' | 'high' | 'standard' | 'maxres', { url: string }>>;

type Video = {
  snippet: {
    title: string;
    description: string;
    categoryId: string;
    tags?: string[];
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    thumbnails: Thumbnails;
  };
  status: {
    privacyStatus: string;
    selfDeclaredMadeForKids?: boolean;
    madeForKids?: boolean;
    embeddable?: boolean;
    license?: string;
    publicStatsViewable?: boolean;
  };
  paidProductPlacementDetails?: { hasPaidProductPlacement: boolean };
};

/** The broadcast Stream sets, as shown with the form. */
export type YouTubeBroadcast = { title: string; live: boolean; thumbnail: string | null };

/** Calls the YouTube Data API as the connected account; uploads go to its own address, given whole. */
async function youtube<T>(account: Account, path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('https://') ? path : `https://www.googleapis.com/youtube/v3/${path}`;
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(account)}`, 'Content-Type': 'application/json', ...init?.headers },
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
async function currentBroadcast(account: Account) {
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

async function video(account: Account, id: string) {
  const { items } = await youtube<{ items: Video[] }>(account, `videos?part=snippet,status,paidProductPlacementDetails&id=${id}`);
  if (!items[0]) throw new PlatformError("YouTube didn't find the broadcast's video.");
  return items[0];
}

/** The biggest 16:9 one there is: YouTube's high and standard sizes are 4:3, with black bars. */
function thumbnail(thumbnails: Thumbnails) {
  return (thumbnails.maxres ?? thumbnails.medium ?? thumbnails.default)?.url ?? null;
}

async function requireBroadcast(userId: string) {
  const account = await platformAccount(userId, 'google');
  if (!account) throw new PlatformError('YouTube is no longer connected.');

  const current = await currentBroadcast(account);
  if (!current) throw new PlatformError("There's no stream coming up on YouTube to set. Open Go live in YouTube Studio once, and it makes one.");
  return { account, id: current.broadcast.id };
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

  const { snippet, status, paidProductPlacementDetails } = await video(account, current.broadcast.id);
  // YouTube's languages can be regional (en-GB) and its tags can have spaces, which Twitch's can't.
  const language = snippet.defaultAudioLanguage?.split('-')[0].toLowerCase();
  return {
    broadcast: { title: current.broadcast.snippet.title, live: current.live, thumbnail: thumbnail(snippet.thumbnails) },
    details: {
      title: snippet.title,
      tags: (snippet.tags ?? []).filter((tag) => tagSchema.safeParse(tag).success),
      language: LANGUAGES.some((known) => known.code === language) ? language! : 'other',
      brandedContent: paidProductPlacementDetails?.hasPaidProductPlacement ?? false,
      youtube: {
        category: YOUTUBE_CATEGORIES.find((category) => category.id === snippet.categoryId)?.id ?? '20',
        description: snippet.description,
        visibility: YOUTUBE_VISIBILITIES.find((visibility) => visibility.id === status.privacyStatus)?.id ?? 'public',
        madeForKids: status.selfDeclaredMadeForKids ?? status.madeForKids ?? false,
      },
    },
  };
}

/**
 * Sets the broadcast's details. YouTube clears what an update leaves out, so whatever Stream doesn't change, like
 * the title's language, is sent back as it was; so are the YouTube-only fields when they weren't in the form.
 */
export async function updateYouTubeStream(userId: string, details: StreamDetails) {
  if (details.title.length > MAX_YOUTUBE_TITLE_LENGTH) throw new PlatformError(`YouTube titles can be at most ${MAX_YOUTUBE_TITLE_LENGTH} characters.`);
  if (/[<>]/.test(details.title)) throw new PlatformError("YouTube titles can't have < or >.");

  const { account, id } = await requireBroadcast(userId);
  const { snippet, status, paidProductPlacementDetails } = await video(account, id);
  await youtube(account, 'videos?part=snippet', {
    method: 'PUT',
    body: JSON.stringify({
      id,
      snippet: {
        title: details.title,
        description: details.youtube?.description ?? snippet.description,
        categoryId: details.youtube?.category ?? snippet.categoryId,
        tags: details.tags,
        defaultLanguage: snippet.defaultLanguage,
        // "Other" isn't a language YouTube knows, so it leaves the one there
        defaultAudioLanguage: details.language === 'other' ? snippet.defaultAudioLanguage : details.language,
      },
    }),
  });

  // The rest on their own, and only when they change, so the above goes through even where YouTube won't take them.
  const madeForKids = status.selfDeclaredMadeForKids ?? status.madeForKids ?? false;
  if (details.youtube && (details.youtube.visibility !== status.privacyStatus || details.youtube.madeForKids !== madeForKids)) {
    await youtube(account, 'videos?part=status', {
      method: 'PUT',
      body: JSON.stringify({
        id,
        status: {
          privacyStatus: details.youtube.visibility,
          selfDeclaredMadeForKids: details.youtube.madeForKids,
          embeddable: status.embeddable,
          license: status.license,
          publicStatsViewable: status.publicStatsViewable,
        },
      }),
    });
  }
  if (details.brandedContent !== (paidProductPlacementDetails?.hasPaidProductPlacement ?? false)) {
    await youtube(account, 'videos?part=paidProductPlacementDetails', {
      method: 'PUT',
      body: JSON.stringify({ id, paidProductPlacementDetails: { hasPaidProductPlacement: details.brandedContent } }),
    });
  }
}

/** Puts a new thumbnail on the broadcast, and gives back its address. */
export async function setYouTubeThumbnail(userId: string, image: File) {
  const { account, id } = await requireBroadcast(userId);
  const { items } = await youtube<{ items: Thumbnails[] }>(account, `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${id}`, {
    method: 'POST',
    headers: { 'Content-Type': image.type },
    body: image,
  });
  return items[0] ? thumbnail(items[0]) : null;
}
