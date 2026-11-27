import { chatHub } from '@/lib/chat/hub';
import { verifyKickWebhook } from '@/lib/chat/kick';
import { KICK_SOURCE, kickMessage, type KickBanEvent, type KickChatEvent } from '@/lib/chat/messages';
import prisma from '@/lib/prisma';

/**
 * Where Kick sends the chat, as its app's webhook: each message on its own, signed by Kick. Answered at once, as
 * Kick gives up on a webhook that keeps failing. Chat messages show; a writer timed out or banned has their messages
 * taken away. Anything else is taken and let go.
 */
export async function POST(request: Request) {
  const body = await request.text();
  if (!(await verifyKickWebhook(request.headers, body))) return new Response('Not from Kick.', { status: 401 });
  const type = request.headers.get('kick-event-type');
  if (type !== 'chat.message.sent' && type !== 'moderation.banned') return new Response(null, { status: 204 });

  const event = JSON.parse(body) as (KickChatEvent | KickBanEvent) & { broadcaster: { user_id: number } };
  const account = await prisma.account.findFirst({
    where: { providerId: 'kick', accountId: String(event.broadcaster.user_id) },
    select: { userId: true },
  });
  if (!account) return new Response(null, { status: 204 });

  const hub = chatHub(account.userId);
  if (type === 'chat.message.sent') hub.receive(KICK_SOURCE, [kickMessage(event as KickChatEvent)]);
  else hub.writerRemoved(KICK_SOURCE, String((event as KickBanEvent).banned_user.user_id));
  return new Response(null, { status: 204 });
}
