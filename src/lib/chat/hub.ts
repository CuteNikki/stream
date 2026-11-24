import 'server-only';

import { TWITCH_SOURCE, youtubeSource } from '@/lib/chat/messages';
import { startTwitchChat, type ChatSink } from '@/lib/chat/twitch';
import type { ChatEvent, ChatMessage, ChatSource } from '@/lib/chat/types';
import { startYouTubeChat } from '@/lib/chat/youtube';
import { PlatformError, platformAccount } from '@/lib/platform';
import { hasAllScopes } from '@/lib/providers';
import { listBroadcasts } from '@/lib/youtube';

/** Messages kept for a chat page opened later, so it doesn't start empty. */
const BACKLOG = 300;
/** How often YouTube is asked for broadcasts that went live or ended, while the chat's open. */
const YOUTUBE_CHECK_MS = 2 * 60_000;
/** How long the connections stay after the last chat page closes, so a reload doesn't start them over. */
const IDLE_MS = 60_000;

type Connection = { source: ChatSource; stop: () => void; liveChatId?: string };

/**
 * One account's chats: each platform's connection, made once and shared by every chat page that's open, with the
 * latest messages kept. They start with the first page and stop a minute after the last one closes.
 */
class ChatHub {
  private listeners = new Set<(event: ChatEvent) => void>();
  private connections = new Map<string, Connection>();
  private backlog: ChatMessage[] = [];
  private youtubeTimer: ReturnType<typeof setInterval> | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(private userId: string) {}

  /** Sends the chat's events to the listener, starting with where it stands now. Gives back what stops it. */
  subscribe(listener: (event: ChatEvent) => void) {
    clearTimeout(this.idleTimer);
    this.listeners.add(listener);
    listener({ type: 'sources', sources: this.sources() });
    if (this.backlog.length) listener({ type: 'messages', messages: this.backlog });
    if (!this.running) void this.start();

    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.idleTimer = setTimeout(() => this.stop(), IDLE_MS);
    };
  }

  /** A YouTube chat's id, to write in it. */
  liveChatId(source: string) {
    return this.connections.get(source)?.liveChatId;
  }

  sources() {
    return [...this.connections.values()].map((connection) => connection.source);
  }

  private emit(event: ChatEvent) {
    for (const listener of this.listeners) listener(event);
  }

  private sink(id: string): ChatSink {
    return {
      messages: (messages) => {
        this.backlog = [...this.backlog, ...messages].slice(-BACKLOG);
        this.emit({ type: 'messages', messages });
      },
      deleted: (ids) => {
        this.backlog = this.backlog.filter((message) => !ids.includes(message.id));
        this.emit({ type: 'deleted', ids });
      },
      cleared: () => {
        this.backlog = this.backlog.filter((message) => message.source !== id);
        this.emit({ type: 'cleared', source: id });
      },
      state: (state, problem) => {
        const connection = this.connections.get(id);
        if (!connection || (connection.source.state === state && connection.source.problem === problem)) return;
        connection.source = { ...connection.source, state, problem };
        this.emit({ type: 'sources', sources: this.sources() });
      },
    };
  }

  private add(source: ChatSource, start: (sink: ChatSink) => () => void, liveChatId?: string) {
    const connection: Connection = { source, stop: () => {}, liveChatId };
    this.connections.set(source.id, connection);
    connection.stop = start(this.sink(source.id));
  }

  private remove(id: string) {
    this.connections.get(id)?.stop();
    this.connections.delete(id);
  }

  private async start() {
    this.running = true;
    const twitch = await platformAccount(this.userId, 'twitch');
    if (twitch && this.running) {
      const source: ChatSource = { id: TWITCH_SOURCE, platform: 'twitch', name: 'Twitch', state: 'connecting' };
      if (hasAllScopes('twitch', twitch.scope)) this.add(source, (sink) => startTwitchChat(twitch, sink));
      else this.add({ ...source, state: 'problem', problem: 'Connect Twitch again on the platforms page, so Stream may use its chat.' }, () => () => {});
    }
    this.emit({ type: 'sources', sources: this.sources() });

    await this.checkYouTube();
    this.youtubeTimer = setInterval(() => void this.checkYouTube(), YOUTUBE_CHECK_MS);
  }

  private stop() {
    this.running = false;
    clearInterval(this.youtubeTimer);
    for (const id of [...this.connections.keys()]) this.remove(id);
  }

  /** Joins the chat of each broadcast that went live, and leaves those that ended. */
  private async checkYouTube() {
    const account = await platformAccount(this.userId, 'google');
    if (!account || !this.running) return;

    let live;
    try {
      live = (await listBroadcasts(account, { upcoming: false })).filter((broadcast) => broadcast.liveChatId);
    } catch (error) {
      if (!(error instanceof PlatformError)) console.error(error);
      return;
    }
    if (!this.running) return;

    const ids = new Set(live.map((broadcast) => youtubeSource(broadcast.id)));
    const gone = [...this.connections.keys()].filter((id) => id.startsWith('youtube:') && !ids.has(id));
    for (const id of gone) this.remove(id);

    const added = live.filter((broadcast) => !this.connections.has(youtubeSource(broadcast.id)));
    for (const broadcast of added) {
      const id = youtubeSource(broadcast.id);
      this.add(
        { id, platform: 'google', name: broadcast.streamKey?.name ?? broadcast.title, state: 'connecting' },
        (sink) => startYouTubeChat(account, id, broadcast.liveChatId!, sink, () => this.endYouTube(id)),
        broadcast.liveChatId!,
      );
    }
    if (gone.length || added.length) this.emit({ type: 'sources', sources: this.sources() });
  }

  private endYouTube(id: string) {
    this.remove(id);
    this.emit({ type: 'sources', sources: this.sources() });
  }
}

// Kept on globalThis, so the dev server's reloads don't leave a second set of connections running
const globalHubs = globalThis as unknown as { streamChatHubs?: Map<string, ChatHub> };
const hubs = (globalHubs.streamChatHubs ??= new Map<string, ChatHub>());

/** The account's chats, made the first time they're asked for. */
export function chatHub(userId: string) {
  let hub = hubs.get(userId);
  if (!hub) {
    hub = new ChatHub(userId);
    hubs.set(userId, hub);
  }
  return hub;
}
