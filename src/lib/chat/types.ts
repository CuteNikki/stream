import type { PlatformId } from '@/lib/providers';

/** A piece of a message: text, or an emote shown as its picture. */
export type ChatPart = { type: 'text'; text: string } | { type: 'emote'; name: string; url: string };

/** What someone is in a chat, shown as a small label by their name. */
export type ChatRole = 'owner' | 'moderator' | 'vip' | 'subscriber' | 'member';

export type ChatMessage = {
  /** Unique across platforms, as each source's ids are prefixed with it. */
  id: string;
  /** The chat it came from, a ChatSource's id. */
  source: string;
  /** Its platform, for its icon even once its chat has ended. */
  platform: PlatformId;
  /** `id` is the writer's id on its platform, to time them out or ban them; messages kept from before it was there have none. */
  author: { id?: string; name: string; color: string | null; roles: ChatRole[] };
  parts: ChatPart[];
  /** A Super Chat's or cheer's amount, as the platform writes it, e.g. '€5.00' or '100 bits'. */
  paid: string | null;
  /** When it was sent, as an ISO date. */
  time: string;
};

/** One chat: Twitch's, or a YouTube broadcast's, as each live broadcast there has its own. */
export type ChatSource = {
  id: string;
  platform: PlatformId;
  /** e.g. 'Twitch', or a YouTube broadcast's stream key name. */
  name: string;
  state: 'connecting' | 'connected' | 'problem';
  /** Why it's not connected, fit to show. */
  problem?: string;
};

/** What the server sends the chat page, one per event-stream message. */
export type ChatEvent =
  | { type: 'sources'; sources: ChatSource[] }
  | { type: 'messages'; messages: ChatMessage[] }
  | { type: 'deleted'; ids: string[] }
  | { type: 'cleared'; source: string };
