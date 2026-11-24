import 'server-only';

import { LANGUAGES, MAX_YOUTUBE_TITLE_LENGTH, YOUTUBE_CATEGORIES, YOUTUBE_VISIBILITIES } from '@/constants/stream';
import { accessToken, PlatformError, platformAccount, reconnect } from '@/lib/platform';
import { tagSchema, type StreamDetails } from '@/lib/schemas';

type Account = { id: string; userId: string; providerId: string };

type Broadcast = {
  id: string;
  snippet: { title: string; scheduledStartTime?: string; actualStartTime?: string; thumbnails: Thumbnails; liveChatId?: string };
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

/** A broadcast a save can go to, as listed with the form. */
export type YouTubeBroadcast = {
  id: string;
  title: string;
  live: boolean;
  /** When it went live, or when it's set to. */
  start: string | null;
  thumbnail: string | null;
  /** The stream key it's bound to, whose name tells a stream and its vertical copy apart. */
  streamKey: { id: string; name: string } | null;
};

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
 * Every broadcast that's live or coming up: live ones first, then those bound to a stream key, as that's where
 * going live in OBS lands, then the soonest. Each says which stream key it's on, so the relay's vertical copy,
 * live beside the stream on its own key, can be told apart.
 */
async function listBroadcasts(account: Account): Promise<YouTubeBroadcast[]> {
  const list = (status: string) =>
    youtube<{ items: Broadcast[] }>(account, `liveBroadcasts?part=snippet,contentDetails&broadcastStatus=${status}&maxResults=50`);
  const [active, upcoming] = await Promise.all([list('active'), list('upcoming')]);
  const broadcasts = [
    ...active.items.map((broadcast) => ({ broadcast, live: true })),
    ...upcoming.items
      .toSorted(
        (a, b) =>
          Number(!a.contentDetails.boundStreamId) - Number(!b.contentDetails.boundStreamId) ||
          (a.snippet.scheduledStartTime ?? '').localeCompare(b.snippet.scheduledStartTime ?? ''),
      )
      .map((broadcast) => ({ broadcast, live: false })),
  ];

  const streamIds = [...new Set(broadcasts.map(({ broadcast }) => broadcast.contentDetails.boundStreamId).filter((id) => id !== undefined))];
  const streams = streamIds.length
    ? (await youtube<{ items: { id: string; snippet: { title: string } }[] }>(account, `liveStreams?part=snippet&id=${streamIds.join(',')}&maxResults=50`))
        .items
    : [];
  const keys = new Map(streams.map((stream) => [stream.id, { id: stream.id, name: stream.snippet.title }]));

  return broadcasts.map(({ broadcast, live }) => ({
    id: broadcast.id,
    title: broadcast.snippet.title,
    live,
    start: (live ? broadcast.snippet.actualStartTime : broadcast.snippet.scheduledStartTime) ?? null,
    thumbnail: thumbnail(broadcast.snippet.thumbnails),
    streamKey: keys.get(broadcast.contentDetails.boundStreamId ?? '') ?? null,
  }));
}

/**
 * The broadcasts a save goes to unless others are ticked: on each stream key the live one, or else the next one
 * coming, so a stream and its vertical copy are both set. Without any bound to a key, the first one listed.
 */
function defaultBroadcasts(broadcasts: YouTubeBroadcast[]) {
  const keys = new Set(broadcasts.flatMap((broadcast) => (broadcast.streamKey ? [broadcast.streamKey.id] : [])));
  // Listed live first, then soonest, so the first on each key is the one
  const picked = [...keys].map((key) => broadcasts.find((broadcast) => broadcast.streamKey?.id === key)!);
  return (picked.length ? picked : broadcasts.slice(0, 1)).map((broadcast) => broadcast.id);
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

/** The account, once the broadcast is checked to be one of its own that's live or coming up. */
async function requireBroadcast(userId: string, id: string) {
  const account = await platformAccount(userId, 'google');
  if (!account) throw new PlatformError('YouTube is no longer connected.');

  const broadcasts = await listBroadcasts(account);
  if (!broadcasts.some((broadcast) => broadcast.id === id))
    throw new PlatformError("That YouTube stream has ended or was removed. Reload the page to see what's there now.");
  return account;
}

/**
 * The broadcasts Stream can set and what the first one ticked is set to, or null if YouTube isn't connected.
 * Without a broadcast, there's nothing to read or set.
 */
export async function getYouTubeStream(
  userId: string,
): Promise<{ broadcasts: YouTubeBroadcast[]; details: Omit<StreamDetails, 'category' | 'labels'> | null } | null> {
  const account = await platformAccount(userId, 'google');
  if (!account) return null;

  const broadcasts = await listBroadcasts(account);
  if (!broadcasts.length) return { broadcasts, details: null };

  const ticked = defaultBroadcasts(broadcasts);
  const { snippet, status, paidProductPlacementDetails } = await video(account, ticked[0]);
  // YouTube's languages can be regional (en-GB) and its tags can have spaces, which Twitch's can't.
  const language = snippet.defaultAudioLanguage?.split('-')[0].toLowerCase();
  return {
    broadcasts,
    details: {
      title: snippet.title,
      tags: (snippet.tags ?? []).filter((tag) => tagSchema.safeParse(tag).success),
      language: LANGUAGES.some((known) => known.code === language) ? language! : 'other',
      brandedContent: paidProductPlacementDetails?.hasPaidProductPlacement ?? false,
      youtube: {
        broadcasts: ticked,
        category: YOUTUBE_CATEGORIES.find((category) => category.id === snippet.categoryId)?.id ?? '20',
        description: snippet.description,
        visibility: YOUTUBE_VISIBILITIES.find((visibility) => visibility.id === status.privacyStatus)?.id ?? 'public',
        madeForKids: status.selfDeclaredMadeForKids ?? status.madeForKids ?? false,
      },
    },
  };
}

/**
 * Sets the ticked broadcasts' details, each on its own so one failing doesn't stop the rest. Without the
 * YouTube-only fields, as when YouTube couldn't be read, it's the broadcasts Stream would tick itself.
 */
export async function updateYouTubeStream(userId: string, details: StreamDetails) {
  if (details.title.length > MAX_YOUTUBE_TITLE_LENGTH) throw new PlatformError(`YouTube titles can be at most ${MAX_YOUTUBE_TITLE_LENGTH} characters.`);
  if (/[<>]/.test(details.title)) throw new PlatformError("YouTube titles can't have < or >.");

  const account = await platformAccount(userId, 'google');
  if (!account) throw new PlatformError('YouTube is no longer connected.');
  const listed = await listBroadcasts(account);
  if (!listed.length) throw new PlatformError("There's no stream coming up on YouTube to set. Open Go live in YouTube Studio once, and it makes one.");

  const ids = details.youtube?.broadcasts ?? defaultBroadcasts(listed);
  const broadcasts = listed.filter((broadcast) => ids.includes(broadcast.id));
  if (!broadcasts.length) throw new PlatformError("Those YouTube streams have ended or were removed. Reload the page to see what's there now.");

  const results = await Promise.allSettled(broadcasts.map((broadcast) => updateBroadcast(account, broadcast.id, details)));
  const failed = results.flatMap((result, index) => (result.status === 'rejected' ? [{ broadcast: broadcasts[index], error: result.reason as unknown }] : []));
  if (!failed.length) return;

  const unexpected = failed.find(({ error }) => !(error instanceof PlatformError));
  if (unexpected) throw unexpected.error;
  // Named only when there are several, so it's clear which didn't take it
  const named = broadcasts.length > 1;
  throw new PlatformError(failed.map(({ broadcast, error }) => `${named ? `${broadcastName(broadcast)}: ` : ''}${(error as Error).message}`).join(' '));
}

/** How a broadcast is told apart in a message: by its stream key, else its title. */
function broadcastName(broadcast: YouTubeBroadcast) {
  return `"${broadcast.streamKey?.name ?? broadcast.title}"`;
}

/**
 * Sets one broadcast's details. YouTube clears what an update leaves out, so whatever Stream doesn't change, like
 * the title's language, is sent back as it was; so are the YouTube-only fields when they weren't in the form.
 */
async function updateBroadcast(account: Account, id: string, details: StreamDetails) {
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

/** Puts a new thumbnail on one of the broadcasts, and gives back its address. */
export async function setYouTubeThumbnail(userId: string, broadcastId: string, image: File) {
  const account = await requireBroadcast(userId, broadcastId);
  const { items } = await youtube<{ items: Thumbnails[] }>(account, `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${broadcastId}`, {
    method: 'POST',
    headers: { 'Content-Type': image.type },
    body: image,
  });
  return items[0] ? thumbnail(items[0]) : null;
}
