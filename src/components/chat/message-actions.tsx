'use client';

import { BanIcon, ClockIcon, EllipsisIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { CHAT_TIMEOUTS } from '@/constants/stream';
import { moderateChatMessage } from '@/lib/actions';
import type { ChatMessage } from '@/lib/chat/types';
import { providerLabel } from '@/lib/providers';
import type { ChatModerationInput } from '@/lib/schemas';

import { useConfirm } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * A message's menu: delete it, or time out or ban whoever wrote it. Shown on hover or focus, and always on touch
 * screens; it takes its place either way, so showing it moves nothing. The streamer can't time out or ban
 * themselves, and messages kept from before Stream knew their writer's id can only be deleted.
 */
export function MessageActions({ message }: { message: ChatMessage }) {
  const [pending, setPending] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const canRemoveWriter = !!message.author.id && !message.author.roles.includes('owner');

  async function run(action: ChatModerationInput['action']) {
    setPending(true);
    const result = await moderateChatMessage({ source: message.source, messageId: message.id, authorId: message.author.id, action });
    setPending(false);
    if (result) toast.error(result.message, { duration: 10000, position: 'top-center' });
  }

  async function ban() {
    const confirmed = await confirm({
      title: `Ban ${message.author.name}?`,
      description: `They can't write in your ${providerLabel(message.platform)} chat until you unban them there, and their messages are taken away.`,
      action: 'Ban',
      destructive: true,
    });
    if (confirmed) await run({ type: 'ban' });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon-xs'
            disabled={pending}
            aria-label={`Moderate ${message.author.name}'s message`}
            className='float-right ml-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 disabled:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100'
          >
            {pending ? <Loader2Icon className='animate-spin' aria-hidden='true' /> : <EllipsisIcon aria-hidden='true' />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-auto'>
          <DropdownMenuItem onSelect={() => void run({ type: 'delete' })}>
            <Trash2Icon aria-hidden='true' />
            Delete message
          </DropdownMenuItem>
          {canRemoveWriter && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ClockIcon aria-hidden='true' />
                  Time out
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {CHAT_TIMEOUTS.map((timeout) => (
                    <DropdownMenuItem key={timeout.seconds} onSelect={() => void run({ type: 'timeout', seconds: timeout.seconds })}>
                      {timeout.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem variant='destructive' onSelect={() => void ban()}>
                <BanIcon aria-hidden='true' />
                Ban
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  );
}
