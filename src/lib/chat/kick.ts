import 'server-only';

import { kickApi } from '@/lib/kick';
import { PlatformError } from '@/lib/platform';
import { siteURL } from '@/lib/site-url';

type Account = { id: string; userId: string; accountId: string; providerId: string };

const CHAT_EVENT = 'chat.message.sent';
/** Writers timed out or banned, whose messages are then taken away. Only with permission to moderate, which Kick may want for it. */
const BAN_EVENT = 'moderation.banned';

/** An event older than this is turned away, so a copy of an old one can't be sent again. */
const MAX_EVENT_AGE_MS = 10 * 60_000;
/** Kick's key is fetched again for a signature that doesn't match, but no more often than this, so fakes can't make Stream ask over and over. */
const KEY_REFETCH_MS = 60_000;

/** Kick only hands its chat to an address on the internet, so on localhost there's nowhere for it to go. */
export function kickChatReachable() {
  return siteURL.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(siteURL.hostname);
}

/**
 * Asks Kick to send the channel's chat to Stream's webhook, the events it doesn't send yet. Asked again each round,
 * as Kick drops a subscription whose webhook kept failing for a day. With `bans`, also its writers timed out or banned.
 */
export async function subscribeToKickChat(account: Account, bans: boolean) {
  const existing = await kickApi<{ data: { event: string }[] }>(account, `v1/events/subscriptions?broadcaster_user_id=${account.accountId}`);
  const missing = (bans ? [CHAT_EVENT, BAN_EVENT] : [CHAT_EVENT]).filter((event) => !existing?.data.some((subscription) => subscription.event === event));
  if (!missing.length) return;

  const created = await kickApi<{ data: { name: string; error?: string }[] }>(account, 'v1/events/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ events: missing.map((name) => ({ name, version: 1 })), method: 'webhook' }),
  });
  const failed = created?.data.find((subscription) => subscription.error);
  if (failed) throw new PlatformError(`Kick: ${failed.error}`);
  console.log(`Chat Kick: subscribed to channel ${account.accountId}`);
}

/** Writes in the channel's chat as the connected account. */
export async function sendKickMessage(account: Account, text: string) {
  const result = await kickApi<{ data: { is_sent: boolean } }>(account, 'v1/chat', {
    method: 'POST',
    body: JSON.stringify({ type: 'user', broadcaster_user_id: Number(account.accountId), content: text }),
  });
  if (!result?.data.is_sent) throw new PlatformError("Kick didn't send it.");
}

/** Kick's public key for its webhooks, kept until a signature doesn't match it, as Kick may change it. */
let publicKey: Promise<CryptoKey> | null = null;
let fetchedAt = 0;

async function fetchPublicKey() {
  fetchedAt = Date.now();
  const response = await fetch('https://api.kick.com/public/v1/public-key', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Kick's public key: ${response.status}`);
  const { data } = (await response.json()) as { data: { public_key: string } };
  const der = Buffer.from(data.public_key.replace(/-----[A-Z ]+-----|\s/g, ''), 'base64');
  return crypto.subtle.importKey('spki', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

async function verifyWith(key: CryptoKey, signature: Uint8Array<ArrayBuffer>, signed: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed);
}

/**
 * Whether a webhook request really is from Kick, by its signature over the message's id, its time and its body,
 * and recent. A signature that doesn't match is checked once more against a freshly fetched key.
 */
export async function verifyKickWebhook(headers: Headers, body: string) {
  const id = headers.get('kick-event-message-id');
  const timestamp = headers.get('kick-event-message-timestamp');
  const signature = headers.get('kick-event-signature');
  if (!id || !timestamp || !signature) return false;

  const sent = Date.parse(timestamp);
  if (Number.isNaN(sent) || Math.abs(Date.now() - sent) > MAX_EVENT_AGE_MS) return false;

  const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
  const decoded = new Uint8Array(Buffer.from(signature, 'base64'));

  publicKey ??= fetchPublicKey();
  try {
    if (await verifyWith(await publicKey, decoded, signed)) return true;
  } catch (error) {
    console.error(error);
  }
  if (Date.now() - fetchedAt < KEY_REFETCH_MS) return false;
  publicKey = fetchPublicKey();
  try {
    return await verifyWith(await publicKey, decoded, signed);
  } catch (error) {
    publicKey = null;
    console.error(error);
    return false;
  }
}
