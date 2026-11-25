import 'server-only';

import { MAX_CHAT_MESSAGE_LENGTH } from '@/constants/stream';
import { chatHub } from '@/lib/chat/hub';
import { sendKickMessage } from '@/lib/chat/kick';
import { KICK_SOURCE, TWITCH_SOURCE } from '@/lib/chat/messages';
import { sendTwitchMessage } from '@/lib/chat/twitch';
import { sendYouTubeMessage } from '@/lib/chat/youtube';
import { PlatformError, platformAccount } from '@/lib/platform';

/** Writes the message in one chat, by its source's id. Its own copy comes back through the chat like any other. */
export async function sendToChat(userId: string, source: string, text: string) {
  if (source === TWITCH_SOURCE) {
    if (text.length > MAX_CHAT_MESSAGE_LENGTH.twitch) throw new PlatformError(`Twitch takes at most ${MAX_CHAT_MESSAGE_LENGTH.twitch} characters.`);
    const account = await platformAccount(userId, 'twitch');
    if (!account) throw new PlatformError('Twitch is no longer connected.');
    return sendTwitchMessage(account, text);
  }

  if (source === KICK_SOURCE) {
    if (text.length > MAX_CHAT_MESSAGE_LENGTH.kick) throw new PlatformError(`Kick takes at most ${MAX_CHAT_MESSAGE_LENGTH.kick} characters.`);
    const account = await platformAccount(userId, 'kick');
    if (!account) throw new PlatformError('Kick is no longer connected.');
    return sendKickMessage(account, text);
  }

  const liveChatId = chatHub(userId).liveChatId(source);
  if (!liveChatId) throw new PlatformError("That YouTube stream's chat has ended.");
  if (text.length > MAX_CHAT_MESSAGE_LENGTH.google) throw new PlatformError(`YouTube takes at most ${MAX_CHAT_MESSAGE_LENGTH.google} characters.`);
  const account = await platformAccount(userId, 'google');
  if (!account) throw new PlatformError('YouTube is no longer connected.');
  return sendYouTubeMessage(account, liveChatId, text);
}

/** What the chat's sources are called, to say which one a message didn't go to. */
export function chatSourceName(userId: string, source: string) {
  return chatHub(userId)
    .sources()
    .find((known) => known.id === source)?.name;
}
