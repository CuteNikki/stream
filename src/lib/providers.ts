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
