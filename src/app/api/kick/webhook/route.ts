import { chatHub } from '@/lib/chat/hub';
import { verifyKickWebhook } from '@/lib/chat/kick';
import { KICK_SOURCE, kickMessage, type KickChatEvent } from '@/lib/chat/messages';
import prisma from '@/lib/prisma';

/**
 * Where Kick sends the chat, as its app's webhook: each message on its own, signed by Kick. Answered at once, as
 * Kick gives up on a webhook that keeps failing; anything that isn't a chat message is taken and let go.
 */
export async function POST(request: Request) {
  const body = await request.text();
  if (!(await verifyKickWebhook(request.headers, body))) return new Response('Not from Kick.', { status: 401 });
  if (request.headers.get('kick-event-type') !== 'chat.message.sent') return new Response(null, { status: 204 });

  const event = JSON.parse(body) as KickChatEvent & { broadcaster: { user_id: number } };
  const account = await prisma.account.findFirst({
    where: { providerId: 'kick', accountId: String(event.broadcaster.user_id) },
    select: { userId: true },
  });
  if (account) chatHub(account.userId).receive(KICK_SOURCE, [kickMessage(event)]);
  return new Response(null, { status: 204 });
}
