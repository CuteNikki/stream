import 'server-only';

import { JsonArrayReader } from '@/lib/chat/json-array-reader';
import type { ChatSink } from '@/lib/chat/twitch';
import { youtubeItem, type LiveChatMessage } from '@/lib/chat/messages';
import { accessToken, PlatformError, reconnect } from '@/lib/platform';
import { youtube } from '@/lib/youtube';

type Account = { id: string; userId: string; providerId: string };

type StreamAnswer = {
  items?: LiveChatMessage[];
  nextPageToken?: string;
  /** Only there once the broadcast has ended. */
  offlineAt?: string;
  error?: { code: number; message: string };
};

/**
 * Keeps a broadcast's chat coming in over YouTube's streamed list: one request that stays open, an answer added
 * whenever there's something new. When it drops, it's asked again from where it left off, so nothing comes twice.
 * Calls `ended` once YouTube says the broadcast is over. Gives back what stops it.
 */
export function startYouTubeChat(account: Account, source: string, liveChatId: string, sink: ChatSink, ended: () => void): () => void {
  const abort = new AbortController();
  let pageToken: string | undefined;
  let failures = 0;

  async function connect() {
    const params = new URLSearchParams({ liveChatId, part: 'snippet,authorDetails', maxResults: '200' });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await fetch(`https://youtube.googleapis.com/youtube/v3/liveChat/messages/stream?${params}`, {
      headers: { Authorization: `Bearer ${await accessToken(account)}` },
      signal: abort.signal,
      cache: 'no-store',
    });
    if (response.status === 401) throw reconnect('google');
    if (!response.body) throw new PlatformError("YouTube's chat didn't answer.");

    const reader = new JsonArrayReader();
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      for (const answer of reader.push(decoder.decode(chunk, { stream: true })) as StreamAnswer[]) {
        if (answer.error) {
          console.error(`YouTube chat stream: ${answer.error.code} ${answer.error.message}`);
          throw new PlatformError(`YouTube: ${answer.error.message}`);
        }
        sink.state('connected');
        failures = 0;
        const items = (answer.items ?? []).map((item) => youtubeItem(source, item)).filter((item) => item !== null);
        const messages = items.flatMap((item) => ('message' in item ? [item.message] : []));
        const deleted = items.flatMap((item) => ('deleted' in item ? [item.deleted] : []));
        if (messages.length) sink.messages(messages);
        if (deleted.length) sink.deleted(deleted);
        pageToken = answer.nextPageToken ?? pageToken;
        if (answer.offlineAt) return 'ended';
      }
    }
    return 'dropped';
  }

  (async () => {
    sink.state('connecting');
    while (!abort.signal.aborted) {
      try {
        if ((await connect()) === 'ended') return ended();
      } catch (error) {
        if (abort.signal.aborted) return;
        if (!(error instanceof PlatformError)) console.error(error);
        sink.state('problem', error instanceof PlatformError ? error.message : "YouTube's chat stopped. Trying again.");
      }
      // Quota spent or the like isn't fixed by asking again at once; each try costs quota too
      await new Promise((resolve) => setTimeout(resolve, Math.min(5 * 60_000, 2000 * 2 ** failures++)));
    }
  })();

  return () => abort.abort();
}

/** Writes in a broadcast's chat as the connected account. */
export async function sendYouTubeMessage(account: Account, liveChatId: string, text: string) {
  await youtube(account, 'liveChat/messages?part=snippet', {
    method: 'POST',
    body: JSON.stringify({ snippet: { liveChatId, type: 'textMessageEvent', textMessageDetails: { messageText: text } } }),
  });
}
