import { CrownIcon, GemIcon, ShieldIcon, StarIcon, type LucideIcon } from 'lucide-react';
import Image from 'next/image';

import type { ChatMessage, ChatRole, ChatSource } from '@/lib/chat/types';
import { cn } from '@/lib/utils';

import { ProviderIcon } from '@/components/common/provider-icon';

const ROLES: Record<ChatRole, { icon: LucideIcon; label: string }> = {
  owner: { icon: CrownIcon, label: 'Streamer' },
  moderator: { icon: ShieldIcon, label: 'Moderator' },
  vip: { icon: GemIcon, label: 'VIP' },
  subscriber: { icon: StarIcon, label: 'Subscriber' },
  member: { icon: StarIcon, label: 'Member' },
};

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

/**
 * One message. In the combined chat it starts with where it came from: the platform's icon, and the chat's name
 * where that platform has more than one, like a stream and its vertical copy on YouTube.
 */
export function ChatMessageRow({ message, source, showSource }: { message: ChatMessage; source?: ChatSource; showSource: 'none' | 'icon' | 'name' }) {
  return (
    <li className={cn('rounded-md px-2 py-1 text-sm leading-relaxed wrap-break-word', message.paid && 'bg-primary/10 border-primary/30 my-1 border')}>
      <time dateTime={message.time} className='text-muted-foreground mr-2 text-xs tabular-nums'>
        {timeFormat.format(new Date(message.time))}
      </time>
      {showSource !== 'none' && source && (
        <span className='mr-1.5 inline-flex items-center gap-1 align-middle'>
          <ProviderIcon provider={source.platform} className='size-3.5' />
          {showSource === 'name' && <span className='text-muted-foreground text-xs'>{source.name}</span>}
        </span>
      )}
      {message.author.roles.map((role) => {
        const { icon: Icon, label } = ROLES[role];
        return <Icon key={role} className='text-muted-foreground mr-1 inline size-3.5 align-middle' aria-label={label} role='img' />;
      })}
      <span
        className='font-semibold'
        // Platforms' name colors are picked for their own backgrounds; mixing in the text color keeps them readable on both themes
        style={message.author.color ? { color: `color-mix(in oklab, ${message.author.color} 70%, var(--foreground))` } : undefined}
      >
        {message.author.name}
      </span>
      {message.paid && <span className='bg-primary text-primary-foreground ml-2 rounded-full px-2 py-0.5 text-xs font-semibold'>{message.paid}</span>}
      {!!message.parts.length && <span className='text-muted-foreground'>: </span>}
      {message.parts.map((part, index) =>
        part.type === 'text' ? (
          <span key={index}>{part.text}</span>
        ) : (
          <Image key={index} src={part.url} alt={part.name} title={part.name} width={28} height={28} unoptimized className='inline size-7 align-middle' />
        ),
      )}
    </li>
  );
}
