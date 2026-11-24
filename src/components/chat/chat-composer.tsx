'use client';

import { Loader2Icon, SendIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { MAX_CHAT_MESSAGE_LENGTH } from '@/constants/stream';
import { sendChatMessage } from '@/lib/actions';
import type { ChatSource } from '@/lib/chat/types';

import { ProviderIcon } from '@/components/common/provider-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Picks every connected chat at once. */
export const EVERY_CHAT = 'every';

/** Writes a message in every chat, or the one picked. The chat it's in when its tab is picked goes first. */
export function ChatComposer({ sources, target, onTargetChange }: { sources: ChatSource[]; target: string; onTargetChange: (target: string) => void }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const connected = sources.filter((source) => source.state === 'connected');
  const targets = target === EVERY_CHAT ? connected : connected.filter((source) => source.id === target);
  // The shortest limit among where it goes, as a longer one wouldn't go everywhere
  const limit = Math.min(...targets.map((source) => MAX_CHAT_MESSAGE_LENGTH[source.platform]), MAX_CHAT_MESSAGE_LENGTH.twitch);
  const shown = target === EVERY_CHAT || connected.some((source) => source.id === target) ? target : EVERY_CHAT;

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message || !targets.length || isSending) return;

    setIsSending(true);
    const result = await sendChatMessage({ text: message, sources: targets.map((source) => source.id) });
    setIsSending(false);

    if ('message' in result) return void toast.error(result.message, { duration: 5000, position: 'top-center' });
    const failed = result.results.filter((sent) => !sent.ok);
    for (const sent of failed) {
      const name = sources.find((source) => source.id === sent.source)?.name ?? 'A chat';
      toast.error(sent.message, { description: `${name} didn't get it.`, duration: 10000, position: 'top-center' });
    }
    // Kept to try again when it went nowhere; its own copy shows in the chat where it went
    if (failed.length < result.results.length) setText('');
  }

  return (
    <form onSubmit={send} className='flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center'>
      <Select value={shown} onValueChange={onTargetChange} disabled={!connected.length}>
        <SelectTrigger className='w-full sm:w-48' aria-label='Send to'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EVERY_CHAT}>Every chat</SelectItem>
          {connected.map((source) => (
            <SelectItem key={source.id} value={source.id}>
              <ProviderIcon provider={source.platform} className='size-4' />
              {source.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className='flex min-w-0 flex-1 gap-2'>
        <div className='relative min-w-0 flex-1'>
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={limit}
            placeholder={connected.length ? 'Write a message' : 'No chat is connected'}
            disabled={!connected.length}
            aria-label='Message'
            autoComplete='off'
            className='pr-16'
          />
          <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs tabular-nums'>
            {text.length}/{limit}
          </span>
        </div>
        <Button type='submit' disabled={!text.trim() || !targets.length || isSending}>
          {isSending ? <Loader2Icon className='animate-spin' aria-hidden='true' /> : <SendIcon aria-hidden='true' />}
          <span className='sr-only sm:not-sr-only'>Send</span>
        </Button>
      </div>
    </form>
  );
}
