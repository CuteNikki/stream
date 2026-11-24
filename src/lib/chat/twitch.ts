import 'server-only';

import { TWITCH_SOURCE, twitchMessage, type ChatMessageEvent } from '@/lib/chat/messages';
import type { ChatMessage } from '@/lib/chat/types';
import { PlatformError } from '@/lib/platform';
import { helix } from '@/lib/twitch';

type Account = { id: string; userId: string; accountId: string; providerId: string };

/** What a chat connection tells the hub. */
export type ChatSink = {
  messages: (messages: ChatMessage[]) => void;
  deleted: (ids: string[]) => void;
  cleared: () => void;
  state: (state: 'connecting' | 'connected' | 'problem', problem?: string) => void;
};

export const MAX_TWITCH_MESSAGE_LENGTH = 500;

const EVENTSUB_URL = 'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30';
const SUBSCRIPTIONS = ['channel.chat.message', 'channel.chat.message_delete', 'channel.chat.clear'];

/**
 * Keeps a connection to Twitch's chat for the account's own channel, through EventSub: it says hello with a
 * session, which the subscriptions are made for, then sends what happens, with a keepalive whenever it's quiet.
 * A silent connection is given up on and made again, and Twitch's own "move to here" is followed without a gap.
 * Gives back what stops it.
 */
export function startTwitchChat(account: Account, sink: ChatSink): () => void {
  let stopped = false;
  let current: WebSocket | null = null;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;

  function reopenLater(problem?: string) {
    if (stopped) return;
    sink.state(problem ? 'problem' : 'connecting', problem);
    // A problem, like a missing permission, isn't fixed by trying again soon
    const delay = problem ? 5 * 60_000 : Math.min(60_000, 1000 * 2 ** failures++);
    retry = setTimeout(() => open(EVENTSUB_URL, false), delay);
  }

  function open(url: string, moved: boolean) {
    const socket = new WebSocket(url);
    // Seconds Twitch may stay quiet before a keepalive, from its hello
    let keepalive = 30;
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => socket.close(), (keepalive + 10) * 1000);
    };

    socket.onmessage = async (event) => {
      if (stopped) return;
      const { metadata, payload } = JSON.parse(String(event.data));
      if (socket === current || metadata.message_type === 'session_welcome') arm();

      switch (metadata.message_type) {
        case 'session_welcome': {
          keepalive = payload.session.keepalive_timeout_seconds ?? keepalive;
          const previous = current;
          current = socket;
          arm();
          if (previous && previous !== socket) {
            previous.onclose = null;
            previous.close();
          }
          // A moved connection keeps its subscriptions; a new one has to make them
          if (!moved) {
            try {
              await subscribe(payload.session.id);
            } catch (error) {
              socket.onclose = null;
              socket.close();
              if (!(error instanceof PlatformError)) console.error(error);
              return reopenLater(error instanceof PlatformError ? error.message : "Twitch's chat couldn't be joined.");
            }
          }
          failures = 0;
          sink.state('connected');
          break;
        }
        case 'session_reconnect':
          open(payload.session.reconnect_url, true);
          break;
        case 'notification':
          handle(payload.subscription.type, payload.event, metadata.message_timestamp);
          break;
        case 'revocation':
          sink.state('problem', 'Twitch stopped sending the chat. Connect Twitch again on the platforms page.');
          break;
      }
    };

    socket.onclose = () => {
      if (stopped || (current !== null && current !== socket)) return;
      clearTimeout(watchdog);
      current = null;
      reopenLater();
    };
  }

  async function subscribe(sessionId: string) {
    const condition = { broadcaster_user_id: account.accountId, user_id: account.accountId };
    for (const type of SUBSCRIPTIONS) {
      await helix(account, 'eventsub/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ type, version: '1', condition, transport: { method: 'websocket', session_id: sessionId } }),
      });
    }
  }

  function handle(type: string, event: ChatMessageEvent & { message_id: string }, time: string) {
    if (type === 'channel.chat.message') sink.messages([twitchMessage(event, time)]);
    else if (type === 'channel.chat.message_delete') sink.deleted([`${TWITCH_SOURCE}:${event.message_id}`]);
    else if (type === 'channel.chat.clear') sink.cleared();
  }

  sink.state('connecting');
  open(EVENTSUB_URL, false);

  return () => {
    stopped = true;
    clearTimeout(watchdog);
    clearTimeout(retry);
    current?.close();
  };
}

/** Writes in the channel's chat as the connected account. */
export async function sendTwitchMessage(account: Account, text: string) {
  const result = await helix<{ data: { is_sent: boolean; drop_reason?: { message: string } | null }[] }>(account, 'chat/messages', {
    method: 'POST',
    body: JSON.stringify({ broadcaster_id: account.accountId, sender_id: account.accountId, message: text }),
  });
  const sent = result?.data[0];
  if (!sent?.is_sent) throw new PlatformError(`Twitch didn't send it${sent?.drop_reason ? `: ${sent.drop_reason.message}` : '.'}`);
}
