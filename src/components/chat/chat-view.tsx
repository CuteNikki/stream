'use client';

import { ArrowDownIcon, MessagesSquareIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { ChatEvent, ChatMessage, ChatSource } from '@/lib/chat/types';
import { cn } from '@/lib/utils';

import { ChatComposer, EVERY_CHAT } from '@/components/chat/chat-composer';
import { ChatMessageRow } from '@/components/chat/chat-message';
import { ProviderIcon } from '@/components/common/provider-icon';
import { Button } from '@/components/ui/button';

/** Messages kept in the page; older ones scroll away for good. */
const KEPT = 500;
/** How close to the bottom still counts as reading along, so new messages keep it scrolled down. */
const FOLLOW_SLACK_PX = 48;
const ALL = 'all';

/**
 * Every chat, live: one at a time from the tabs, or all of them in one feed, where each message says where it came
 * from. Below it, a message goes to every chat or the one picked.
 */
export function ChatView() {
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [online, setOnline] = useState(true);
  const [tab, setTab] = useState(ALL);
  const [target, setTarget] = useState(EVERY_CHAT);
  const [following, setFollowing] = useState(true);
  const feed = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const events = new EventSource('/api/chat');
    events.onopen = () => setOnline(true);
    // It tries again by itself; the server then sends where things stand, which is merged in
    events.onerror = () => setOnline(false);
    events.onmessage = (message) => {
      const event = JSON.parse(message.data) as ChatEvent;
      if (event.type === 'sources') setSources(event.sources);
      else if (event.type === 'messages')
        setMessages((current) => {
          const known = new Set(current.map((existing) => existing.id));
          return [...current, ...event.messages.filter((added) => !known.has(added.id))].slice(-KEPT);
        });
      else if (event.type === 'deleted') setMessages((current) => current.filter((existing) => !event.ids.includes(existing.id)));
      else setMessages((current) => current.filter((existing) => existing.source !== event.source));
    };
    return () => events.close();
  }, []);

  const shownTab = tab === ALL || sources.some((source) => source.id === tab) ? tab : ALL;
  const shown = shownTab === ALL ? messages : messages.filter((message) => message.source === shownTab);

  // Kept at the bottom while reading along, and left alone when scrolled up to read back
  useLayoutEffect(() => {
    if (following && feed.current) feed.current.scrollTop = feed.current.scrollHeight;
  }, [shown, following]);

  function pickTab(id: string) {
    setTab(id);
    setTarget(id === ALL ? EVERY_CHAT : id);
    setFollowing(true);
  }

  // A platform's chats are told apart by name only when it has more than one
  const perPlatform = (source: ChatSource) => sources.filter((other) => other.platform === source.platform).length;
  const problems = sources.filter((source) => source.state === 'problem');

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className='flex shrink-0 flex-wrap gap-2' role='group' aria-label='Chats'>
        <TabButton current={shownTab === ALL} onClick={() => pickTab(ALL)}>
          <MessagesSquareIcon className='size-4' aria-hidden='true' />
          All
        </TabButton>
        {sources.map((source) => (
          <TabButton key={source.id} current={shownTab === source.id} onClick={() => pickTab(source.id)}>
            <ProviderIcon provider={source.platform} className='size-4' />
            {source.name}
            <span
              className={cn(
                'size-2 rounded-full',
                source.state === 'connected' && 'bg-emerald-500',
                source.state === 'connecting' && 'bg-muted-foreground animate-pulse',
                source.state === 'problem' && 'bg-destructive',
              )}
              title={source.state === 'connected' ? 'Connected' : source.state === 'connecting' ? 'Connecting' : source.problem}
            />
          </TabButton>
        ))}
      </div>

      {(!online || !!problems.length) && (
        <div className='border-destructive/30 bg-destructive/5 flex shrink-0 flex-col gap-1 rounded-xl border p-3 text-sm'>
          {!online && <p>Lost the connection to Stream. Trying again...</p>}
          {problems.map((source) => (
            <p key={source.id}>
              <span className='font-semibold'>{source.name}:</span> {source.problem}
            </p>
          ))}
        </div>
      )}

      <div className='relative flex min-h-72 flex-1 flex-col'>
        <div
          ref={feed}
          onScroll={(event) => {
            const element = event.currentTarget;
            setFollowing(element.scrollHeight - element.scrollTop - element.clientHeight <= FOLLOW_SLACK_PX);
          }}
          className='bg-card min-h-0 flex-1 overflow-y-auto rounded-xl border p-2'
        >
          {shown.length ? (
            <ul className='flex flex-col'>
              {shown.map((message) => {
                const source = sources.find((known) => known.id === message.source);
                return (
                  <ChatMessageRow
                    key={message.id}
                    message={message}
                    source={source}
                    showSource={shownTab !== ALL ? 'none' : source && perPlatform(source) > 1 ? 'name' : 'icon'}
                  />
                );
              })}
            </ul>
          ) : (
            <p className='text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm text-balance'>
              {sources.length ? 'No messages yet. They show here as they come in.' : 'Nothing is live. Chats show here once a stream starts.'}
            </p>
          )}
        </div>
        {!following && (
          <Button size='sm' variant='secondary' className='absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md' onClick={() => setFollowing(true)}>
            <ArrowDownIcon aria-hidden='true' />
            Latest messages
          </Button>
        )}
      </div>

      <ChatComposer sources={sources} target={target} onTargetChange={setTarget} />
    </div>
  );
}

function TabButton({ current, onClick, children }: { current: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type='button' size='sm' variant={current ? 'default' : 'outline'} aria-pressed={current} onClick={onClick}>
      {children}
    </Button>
  );
}
