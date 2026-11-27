import 'server-only';

import { chatHub } from '@/lib/chat/hub';
import { KICK_SOURCE, TWITCH_SOURCE } from '@/lib/chat/messages';
import { kickApi } from '@/lib/kick';
import { PlatformError, platformAccount } from '@/lib/platform';
import { hasAllScopes, MODERATION_SCOPES, providerLabel, type PlatformId } from '@/lib/providers';
import type { ChatModerationInput } from '@/lib/schemas';
import { helix } from '@/lib/twitch';
import { youtube } from '@/lib/youtube';

/** The connected account, if it may moderate the platform's chat. */
async function moderator(userId: string, platform: PlatformId) {
  const account = await platformAccount(userId, platform);
  const label = providerLabel(platform);
  if (!account) throw new PlatformError(`${label} is no longer connected.`);
  if (!hasAllScopes(platform, account.scope, MODERATION_SCOPES))
    throw new PlatformError(`Connect ${label} again on the platforms page, so Stream may moderate its chat.`);
  return account;
}

/**
 * Deletes a message, or times out or bans its writer, on the chat's platform. It's taken away here at once, as
 * Kick doesn't say when a message was deleted; Twitch's and YouTube's own word of it changes nothing more.
 */
export async function moderateChat(userId: string, { source, messageId, authorId, action }: ChatModerationInput) {
  if (!messageId.startsWith(`${source}:`)) throw new PlatformError("That message isn't in that chat.");
  // The platform's own id, without the source it's prefixed with
  const platformMessageId = messageId.slice(source.length + 1);
  const hub = chatHub(userId);
  if (action.type !== 'delete' && !authorId) throw new PlatformError("That message doesn't say who wrote it.");
  const seconds = action.type === 'timeout' ? action.seconds : undefined;

  if (source === TWITCH_SOURCE) {
    const account = await moderator(userId, 'twitch');
    const ids = `broadcaster_id=${account.accountId}&moderator_id=${account.accountId}`;
    if (action.type === 'delete') await helix(account, `moderation/chat?${ids}&message_id=${encodeURIComponent(platformMessageId)}`, { method: 'DELETE' });
    else
      await helix(account, `moderation/bans?${ids}`, {
        method: 'POST',
        body: JSON.stringify({ data: { user_id: authorId, ...(seconds && { duration: seconds }) } }),
      });
  } else if (source === KICK_SOURCE) {
    const account = await moderator(userId, 'kick');
    if (action.type === 'delete') await kickApi(account, `v1/chat/${encodeURIComponent(platformMessageId)}`, { method: 'DELETE' });
    else
      await kickApi(account, 'v1/moderation/bans', {
        method: 'POST',
        body: JSON.stringify({
          broadcaster_user_id: Number(account.accountId),
          user_id: Number(authorId),
          // Kick counts a timeout in minutes; without one, it's a ban
          ...(seconds && { duration: seconds / 60 }),
        }),
      });
  } else {
    const liveChatId = hub.liveChatId(source);
    if (!liveChatId) throw new PlatformError("That YouTube stream's chat has ended.");
    const account = await moderator(userId, 'google');
    if (action.type === 'delete') await youtube(account, `liveChat/messages?id=${encodeURIComponent(platformMessageId)}`, { method: 'DELETE' });
    else
      await youtube(account, 'liveChat/bans?part=snippet', {
        method: 'POST',
        body: JSON.stringify({
          snippet: {
            liveChatId,
            type: seconds ? 'temporary' : 'permanent',
            ...(seconds && { banDurationSeconds: seconds }),
            bannedUserDetails: { channelId: authorId },
          },
        }),
      });
  }

  if (action.type === 'delete') hub.messagesRemoved(source, [messageId]);
  else hub.writerRemoved(source, authorId!);
}
