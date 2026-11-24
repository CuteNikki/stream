import { chatHub } from '@/lib/chat/hub';
import type { ChatEvent } from '@/lib/chat/types';
import { getSession } from '@/lib/session';

/** A comment line now and then, so nothing between here and the browser takes a quiet chat for a dead one. */
const PING_MS = 25_000;

/**
 * The chat as it happens, as server-sent events: first where it stands, its sources and latest messages, then
 * each change. The platforms' connections stay on the server, shared by every page that's open.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response('Not signed in.', { status: 401 });

  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          stop();
        }
      };
      const unsubscribe = chatHub(session.user.id).subscribe((event: ChatEvent) => send(`data: ${JSON.stringify(event)}\n\n`));
      const ping = setInterval(() => send(': ping\n\n'), PING_MS);
      let stopped = false;
      // Once only: it's called both when the browser leaves and when the stream is cancelled
      stop = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(ping);
        unsubscribe();
      };
      request.signal.addEventListener('abort', () => {
        stop();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
