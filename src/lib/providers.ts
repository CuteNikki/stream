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
] as const;

export type PlatformId = (typeof PLATFORMS)[number]['id'];

/** What each platform lets Stream do, asked for when it's connected: set the stream's details, and read and write its chat. */
export const PLATFORM_SCOPES: Record<PlatformId, string[]> = {
  twitch: ['channel:manage:broadcast', 'user:read:chat', 'user:write:chat'],
  google: ['https://www.googleapis.com/auth/youtube.force-ssl'],
};

/**
 * Whether a connected account was given everything Stream asks for now. One connected before Stream asked for more,
 * like Twitch's chat, needs connecting again, which adds the rest.
 */
export function hasAllScopes(platform: string, scope: string | null) {
  const granted = new Set((scope ?? '').split(',').map((part) => part.trim()));
  return !(platform in PLATFORM_SCOPES) || PLATFORM_SCOPES[platform as PlatformId].every((needed) => granted.has(needed));
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
