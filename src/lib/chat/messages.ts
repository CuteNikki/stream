import type { ChatMessage, ChatPart, ChatRole } from '@/lib/chat/types';

/*
 * How each platform's chat events become the chat's own messages. Kept apart from the connections, which are
 * server-only, so they can be tested on their own.
 */

export const TWITCH_SOURCE = 'twitch';

const BADGE_ROLES: Record<string, ChatRole> = { broadcaster: 'owner', moderator: 'moderator', vip: 'vip', subscriber: 'subscriber', founder: 'subscriber' };

export type ChatMessageEvent = {
  message_id: string;
  chatter_user_id: string;
  chatter_user_name: string;
  color: string;
  badges: { set_id: string }[];
  message: { text: string; fragments: { type: string; text: string; emote?: { id: string; format?: string[] } | null }[] };
  cheer?: { bits: number } | null;
};

/** A message as Twitch sends it, the way the chat shows it. */
export function twitchMessage(event: ChatMessageEvent, time: string): ChatMessage {
  const parts = event.message.fragments.map((fragment): ChatPart => {
    if (fragment.type !== 'emote' || !fragment.emote) return { type: 'text', text: fragment.text };
    const format = fragment.emote.format?.includes('animated') ? 'animated' : 'static';
    return { type: 'emote', name: fragment.text, url: `https://static-cdn.jtvnw.net/emoticons/v2/${fragment.emote.id}/${format}/dark/2.0` };
  });
  return {
    id: `${TWITCH_SOURCE}:${event.message_id}`,
    source: TWITCH_SOURCE,
    platform: 'twitch',
    author: {
      id: event.chatter_user_id,
      name: event.chatter_user_name,
      color: event.color || null,
      roles: [...new Set(event.badges.flatMap((badge) => (BADGE_ROLES[badge.set_id] ? [BADGE_ROLES[badge.set_id]] : [])))],
    },
    parts: parts.length ? parts : [{ type: 'text', text: event.message.text }],
    paid: event.cheer?.bits ? `${event.cheer.bits} bits` : null,
    time,
  };
}

/** A YouTube broadcast's chat is its own source, by the broadcast's id. */
export function youtubeSource(broadcastId: string) {
  return `youtube:${broadcastId}`;
}

export type LiveChatMessage = {
  id: string;
  snippet: {
    type: string;
    publishedAt: string;
    displayMessage?: string;
    superChatDetails?: { amountDisplayString: string; userComment?: string };
    superStickerDetails?: { amountDisplayString: string };
    deletedMessageDetails?: { deletedMessageId: string };
  };
  authorDetails?: { channelId: string; displayName: string; isChatOwner: boolean; isChatModerator: boolean; isChatSponsor: boolean };
};

/** What one of YouTube's chat items means for the chat: a message to show, one to take away, or nothing. */
export function youtubeItem(source: string, item: LiveChatMessage): { message: ChatMessage } | { deleted: string } | null {
  const { snippet, authorDetails } = item;
  if (snippet.type === 'messageDeletedEvent' && snippet.deletedMessageDetails)
    return { deleted: `${source}:${snippet.deletedMessageDetails.deletedMessageId}` };
  const shown = ['textMessageEvent', 'superChatEvent', 'superStickerEvent', 'newSponsorEvent', 'memberMilestoneChatEvent', 'membershipGiftingEvent'];
  if (!shown.includes(snippet.type) || !authorDetails) return null;

  const roles: ChatRole[] = [];
  if (authorDetails.isChatOwner) roles.push('owner');
  if (authorDetails.isChatModerator) roles.push('moderator');
  if (authorDetails.isChatSponsor) roles.push('member');
  const text = snippet.superChatDetails?.userComment ?? snippet.displayMessage ?? '';
  return {
    message: {
      id: `${source}:${item.id}`,
      source,
      platform: 'google',
      author: { id: authorDetails.channelId, name: authorDetails.displayName, color: null, roles },
      parts: text ? [{ type: 'text', text }] : [],
      paid: snippet.superChatDetails?.amountDisplayString ?? snippet.superStickerDetails?.amountDisplayString ?? null,
      time: snippet.publishedAt,
    },
  };
}

/** Kick has one chat, the channel's, whether it's live or not. */
export const KICK_SOURCE = 'kick';

const KICK_BADGE_ROLES: Record<string, ChatRole> = {
  broadcaster: 'owner',
  moderator: 'moderator',
  vip: 'vip',
  subscriber: 'subscriber',
  founder: 'subscriber',
};

export type KickChatEvent = {
  message_id: string;
  sender: { user_id: number; username: string; identity: { username_color: string; badges: { type: string }[] } | null };
  content: string;
  created_at: string;
};

/**
 * A message as Kick's webhook sends it, the way the chat shows it. Emotes are written into its text as
 * [emote:<id>:<name>], their pictures at Kick's own address for them.
 */
export function kickMessage(event: KickChatEvent): ChatMessage {
  const parts: ChatPart[] = [];
  let last = 0;
  for (const match of event.content.matchAll(/\[emote:(\d+):([^\]]+)\]/g)) {
    if (match.index > last) parts.push({ type: 'text', text: event.content.slice(last, match.index) });
    parts.push({ type: 'emote', name: match[2], url: `https://files.kick.com/emotes/${match[1]}/fullsize` });
    last = match.index + match[0].length;
  }
  if (last < event.content.length) parts.push({ type: 'text', text: event.content.slice(last) });

  const badges = event.sender.identity?.badges ?? [];
  return {
    id: `${KICK_SOURCE}:${event.message_id}`,
    source: KICK_SOURCE,
    platform: 'kick',
    author: {
      id: String(event.sender.user_id),
      name: event.sender.username,
      color: event.sender.identity?.username_color || null,
      roles: [...new Set(badges.flatMap((badge) => (KICK_BADGE_ROLES[badge.type] ? [KICK_BADGE_ROLES[badge.type]] : [])))],
    },
    parts,
    paid: null,
    time: event.created_at,
  };
}
