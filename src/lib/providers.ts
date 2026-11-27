/**
 * The platforms stream can change a stream's details on, in the order they
 * show. Each is connected from the platforms page, as an account linked to
 * yours, and only turns on when its client id and secret are set, as
 * `<ID>_CLIENT_ID` and `<ID>_CLIENT_SECRET` (see lib/auth.ts). YouTube signs
 * in with Google, so it's `google` here.
 */
export const PLATFORMS = [
  { id: 'twitch', label: 'Twitch' },
  { id: 'google', label: 'YouTube' },
  { id: 'kick', label: 'Kick' },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]['id'];

/** What each platform's chat needs: reading it and writing in it. */
export const CHAT_SCOPES: Record<PlatformId, string[]> = {
  twitch: ['user:read:chat', 'user:write:chat'],
  google: ['https://www.googleapis.com/auth/youtube.force-ssl'],
  // Its chat comes to Stream's webhook, through events:subscribe
  kick: ['chat:write', 'events:subscribe'],
};

/** What moderating each platform's chat needs: deleting messages, and timing out and banning their writers. */
export const MODERATION_SCOPES: Record<PlatformId, string[]> = {
  twitch: ['moderator:manage:chat_messages', 'moderator:manage:banned_users'],
  // youtube.force-ssl covers moderating too
  google: ['https://www.googleapis.com/auth/youtube.force-ssl'],
  kick: ['moderation:chat_message:manage', 'moderation:ban'],
};

/** What each platform lets Stream do, asked for when it's connected: set the stream's details, and read, write and moderate its chat. */
export const PLATFORM_SCOPES: Record<PlatformId, string[]> = {
  twitch: [...new Set(['channel:manage:broadcast', ...CHAT_SCOPES.twitch, ...MODERATION_SCOPES.twitch])],
  google: [...new Set([...CHAT_SCOPES.google, ...MODERATION_SCOPES.google])],
  // user:read is always asked for, by Better Auth
  kick: [...new Set(['channel:read', 'channel:write', ...CHAT_SCOPES.kick, ...MODERATION_SCOPES.kick])],
};

/**
 * Whether a connected account was given everything Stream asks for now, or only the `needed` ones. One connected
 * before Stream asked for more, like moderating its chat, needs connecting again, which adds the rest.
 */
export function hasAllScopes(platform: string, scope: string | null, needed?: Record<PlatformId, string[]>) {
  const granted = new Set((scope ?? '').split(',').map((part) => part.trim()));
  const wanted = needed ?? PLATFORM_SCOPES;
  return !(platform in wanted) || wanted[platform as PlatformId].every((one) => granted.has(one));
}

export function providerLabel(id: string) {
  return PLATFORMS.find((platform) => platform.id === id)?.label ?? id;
}

/** Why connecting a platform didn't work, from Better Auth's ?error=. */
export function socialErrorMessage(error: string) {
  switch (error) {
    case 'account_already_linked_to_different_user':
      return 'That account is already connected.';
    case 'access_denied':
      return 'Connecting was cancelled.';
    case 'unable_to_link_account':
      return "That account couldn't be connected. Please try again.";
    default:
      return "That didn't work. Please try again.";
  }
}
