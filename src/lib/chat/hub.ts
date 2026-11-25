import 'server-only';

import { kickChatReachable, subscribeToKickChat } from '@/lib/chat/kick';
import { KICK_SOURCE, TWITCH_SOURCE, youtubeSource } from '@/lib/chat/messages';
import { startTwitchChat, type ChatSink } from '@/lib/chat/twitch';
import type { ChatEvent, ChatMessage, ChatSource } from '@/lib/chat/types';
import { startYouTubeChat } from '@/lib/chat/youtube';
import { PlatformError, platformAccount } from '@/lib/platform';
import prisma from '@/lib/prisma';
import { hasAllScopes } from '@/lib/providers';
import { listBroadcasts } from '@/lib/youtube';

/** Messages kept for a chat page opened later, so it doesn't start empty. */
const BACKLOG = 300;
/** How long messages are kept in the database, for after a restart. */
const HISTORY_MS = 24 * 60 * 60_000;
/** How often the platforms are checked again while the chat's open: YouTube for broadcasts that went live or ended, Twitch for being connected again. */
const CHECK_MS = 2 * 60_000;
/** A page opened while a chat has a problem checks again at once, but not more often than this. */
const RECHECK_MS = 10_000;
/** How long the connections stay after the last chat page closes, so a reload doesn't start them over. */
const IDLE_MS = 60_000;

type Connection = {
  source: ChatSource;
  stop: () => void;
  liveChatId?: string;
  /** Only saying what's missing, like Twitch's chat permissions, with nothing connected. */
  waiting?: boolean;
};

/**
 * One account's chats: each platform's connection, made once and shared by every chat page that's open, with the
 * latest messages kept. They start with the first page and stop a minute after the last one closes.
 */
class ChatHub {
  private listeners = new Set<(event: ChatEvent) => void>();
  private connections = new Map<string, Connection>();
  private backlog: ChatMessage[] = [];
  private checkTimer: ReturnType<typeof setInterval> | undefined;
  private lastCheck = 0;
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
    // Say Twitch was connected again since: a reload is the obvious thing to try, so it should work
    else if (this.sources().some((source) => source.state === 'problem') && Date.now() - this.lastCheck > RECHECK_MS) void this.check();

    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.idleTimer = setTimeout(() => this.stop(), IDLE_MS);
    };
  }

  /**
   * Messages from Kick's webhook, which comes on its own rather than through a connection held here. Only taken
   * while the chat is open, like the other platforms' chats.
   */
  receive(source: string, messages: ChatMessage[]) {
    if (!this.running || !this.connections.has(source)) return;
    this.sink(source).messages(messages);
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
      messages: (incoming) => {
        // YouTube sends its recent chat again on each connect, which can already be here, loaded from the database
        const known = new Set(this.backlog.map((message) => message.id));
        const messages = incoming.filter((message) => !known.has(message.id));
        if (!messages.length) return;
        this.backlog = [...this.backlog, ...messages].slice(-BACKLOG);
        this.emit({ type: 'messages', messages });
        this.save(messages);
      },
      deleted: (ids) => {
        this.backlog = this.backlog.filter((message) => !ids.includes(message.id));
        this.emit({ type: 'deleted', ids });
        this.forget(prisma.chatMessage.deleteMany({ where: { userId: this.userId, id: { in: ids } } }));
      },
      cleared: () => {
        this.backlog = this.backlog.filter((message) => message.source !== id);
        this.emit({ type: 'cleared', source: id });
        this.forget(prisma.chatMessage.deleteMany({ where: { userId: this.userId, source: id } }));
      },
      state: (state, problem) => {
        const connection = this.connections.get(id);
        if (!connection || (connection.source.state === state && connection.source.problem === problem)) return;
        connection.source = { ...connection.source, state, problem };
        console.log(`Chat ${connection.source.name}: ${state}${problem ? ` (${problem})` : ''}`);
        this.emit({ type: 'sources', sources: this.sources() });
      },
    };
  }

  private add(source: ChatSource, start: (sink: ChatSink) => () => void, liveChatId?: string, waiting?: boolean) {
    const connection: Connection = { source, stop: () => {}, liveChatId, waiting };
    this.connections.set(source.id, connection);
    connection.stop = start(this.sink(source.id));
  }

  private remove(id: string) {
    this.connections.get(id)?.stop();
    this.connections.delete(id);
  }

  private async start() {
    this.running = true;
    await this.loadHistory();
    await this.check();
    this.checkTimer = setInterval(() => void this.check(), CHECK_MS);
  }

  private stop() {
    this.running = false;
    clearInterval(this.checkTimer);
    for (const id of [...this.connections.keys()]) this.remove(id);
  }

  private async check() {
    this.lastCheck = Date.now();
    this.forget(prisma.chatMessage.deleteMany({ where: { userId: this.userId, time: { lt: new Date(Date.now() - HISTORY_MS) } } }));
    await this.checkTwitch();
    await this.checkYouTube();
    await this.checkKick();
  }

  /**
   * Connects Twitch's chat once it's allowed to, or says what's missing. Checked again each round, so connecting
   * Twitch again while the chat's open takes effect, and disconnecting it ends its chat.
   */
  private async checkTwitch() {
    const account = await platformAccount(this.userId, 'twitch');
    if (!this.running) return;
    const current = this.connections.get(TWITCH_SOURCE);
    const allowed = !!account && hasAllScopes('twitch', account.scope);
    // Already as it should be: connected and allowed, or waiting and still not
    if (current && account && !!current.waiting === !allowed) return;
    if (!current && !account) return;

    if (current) this.remove(TWITCH_SOURCE);
    if (account) {
      const source: ChatSource = { id: TWITCH_SOURCE, platform: 'twitch', name: 'Twitch', state: 'connecting' };
      if (allowed) this.add(source, (sink) => startTwitchChat(account, sink));
      else
        this.add(
          { ...source, state: 'problem', problem: 'Connect Twitch again on the platforms page, so Stream may use its chat.' },
          () => () => {},
          undefined,
          true,
        );
    }
    this.emit({ type: 'sources', sources: this.sources() });
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

    if (live.length !== [...this.connections.keys()].filter((id) => id.startsWith('youtube:')).length)
      console.log(`Chat: YouTube has ${live.length} live broadcast${live.length === 1 ? '' : 's'} with a chat`);
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

  /**
   * Has Kick send its chat to the webhook, or says why it can't: a permission missing, or a Stream that Kick can't
   * reach, like one on localhost. Checked again each round, like Twitch.
   */
  private async checkKick() {
    const account = await platformAccount(this.userId, 'kick');
    if (!this.running) return;
    const current = this.connections.get(KICK_SOURCE);
    if (!account) {
      if (!current) return;
      this.remove(KICK_SOURCE);
      return this.emit({ type: 'sources', sources: this.sources() });
    }

    if (!current) this.add({ id: KICK_SOURCE, platform: 'kick', name: 'Kick', state: 'connecting' }, () => () => {});
    const sink = this.sink(KICK_SOURCE);
    if (!current) this.emit({ type: 'sources', sources: this.sources() });

    if (!hasAllScopes('kick', account.scope)) return sink.state('problem', 'Connect Kick again on the platforms page, so Stream may use its chat.');
    if (!kickChatReachable()) return sink.state('problem', "Kick's chat only arrives where Kick can reach Stream, on its public address, not on localhost.");
    try {
      await subscribeToKickChat(account);
      sink.state('connected');
    } catch (error) {
      if (!(error instanceof PlatformError)) console.error(error);
      sink.state('problem', error instanceof PlatformError ? error.message : "Kick's chat couldn't be joined.");
    }
  }

  /** The messages kept from before Stream last started, as Twitch can't be asked for them. */
  private async loadHistory() {
    try {
      const rows = await prisma.chatMessage.findMany({
        where: { userId: this.userId, time: { gt: new Date(Date.now() - HISTORY_MS) } },
        orderBy: { time: 'desc' },
        take: BACKLOG,
      });
      const known = new Set(this.backlog.map((message) => message.id));
      const history = rows
        .toReversed()
        .filter((row) => !known.has(row.id))
        .map((row) => ({ ...(row.data as Omit<ChatMessage, 'id' | 'source' | 'time'>), id: row.id, source: row.source, time: row.time.toISOString() }));
      if (!history.length) return;
      this.backlog = [...history, ...this.backlog].slice(-BACKLOG);
      this.emit({ type: 'messages', messages: history });
    } catch (error) {
      console.error(error);
    }
  }

  /** Keeps messages for after a restart, apart from the chat itself: one that isn't saved is still shown. */
  private save(messages: ChatMessage[]) {
    this.forget(
      prisma.chatMessage.createMany({
        data: messages.map(({ id, source, time, ...data }) => ({ id, userId: this.userId, source, time: new Date(time), data })),
        skipDuplicates: true,
      }),
    );
  }

  /** Runs a database write without waiting on it, logging it if it fails. */
  private forget(write: Promise<unknown>) {
    write.catch((error: unknown) => console.error(error));
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
