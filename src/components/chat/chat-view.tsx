'use client';

import { ArrowDownIcon, Columns3Icon, MessagesSquareIcon } from 'lucide-react';
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
const SIDE_BY_SIDE = 'side-by-side';

/**
 * Every chat, live: all of them in one feed, where each message says where it came from; side by side, a column
 * each; or one at a time from the tabs. Below it, a message goes to every chat or the one picked.
 */
export function ChatView({ initialView }: { initialView?: string }) {
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [online, setOnline] = useState(true);
  // From ?view=, so a reload keeps it: side-by-side, or a chat's id; All is the page without it
  const [tab, setTab] = useState(initialView ?? ALL);
  const [target, setTarget] = useState(!initialView || initialView === SIDE_BY_SIDE ? EVERY_CHAT : initialView);

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
          // Each once, also within a batch
          const known = new Set(current.map((existing) => existing.id));
          const added = event.messages.filter((message) => {
            if (known.has(message.id)) return false;
            known.add(message.id);
            return true;
          });
          return [...current, ...added].slice(-KEPT);
        });
      else if (event.type === 'deleted') setMessages((current) => current.filter((existing) => !event.ids.includes(existing.id)));
      else
        setMessages((current) =>
          current.filter((existing) => existing.source !== event.source || (event.author !== undefined && existing.author.id !== event.author)),
        );
    };
    return () => events.close();
  }, []);

  const shownTab = tab === ALL || tab === SIDE_BY_SIDE || sources.some((source) => source.id === tab) ? tab : ALL;
  const emptyText = sources.length ? 'No messages yet. They show here as they come in.' : 'Nothing is live. Chats show here once a stream starts.';

  function pickTab(id: string) {
    setTab(id);
    setTarget(id === ALL || id === SIDE_BY_SIDE ? EVERY_CHAT : id);
    // Into the address without a navigation, which Next.js keeps in step with
    const url = new URL(window.location.href);
    if (id === ALL) url.searchParams.delete('view');
    else url.searchParams.set('view', id);
    window.history.replaceState(null, '', url);
  }

  const problems = sources.filter((source) => source.state === 'problem');

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className='flex shrink-0 flex-wrap gap-2' role='group' aria-label='Chats'>
        <TabButton current={shownTab === ALL} onClick={() => pickTab(ALL)}>
          <MessagesSquareIcon className='size-4' aria-hidden='true' />
          All
        </TabButton>
        <TabButton current={shownTab === SIDE_BY_SIDE} onClick={() => pickTab(SIDE_BY_SIDE)}>
          <Columns3Icon className='size-4' aria-hidden='true' />
          Side by side
        </TabButton>
        {sources.map((source) => (
          <TabButton key={source.id} current={shownTab === source.id} onClick={() => pickTab(source.id)}>
            <ProviderIcon provider={source.platform} plain={shownTab === source.id} className='size-4' />
            {source.name}
            <StateDot source={source} />
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

      {shownTab === SIDE_BY_SIDE && sources.length ? (
        // A column each, scrolled sideways where they don't all fit, like on phones
        <div className='flex min-h-72 flex-1 snap-x gap-3 overflow-x-auto'>
          {sources.map((source) => (
            <section key={source.id} aria-label={source.name} className='flex min-w-72 flex-1 snap-start flex-col gap-2'>
              <h2 className='flex items-center gap-1.5 px-1 text-sm font-semibold'>
                <ProviderIcon provider={source.platform} className='size-4' />
                <span className='truncate'>{source.name}</span>
                <StateDot source={source} />
              </h2>
              <ChatFeed messages={messages.filter((message) => message.source === source.id)} emptyText={emptyText} />
            </section>
          ))}
        </div>
      ) : (
        <ChatFeed
          // A new feed for each tab, so it starts at the newest
          key={shownTab}
          messages={shownTab === ALL || shownTab === SIDE_BY_SIDE ? messages : messages.filter((message) => message.source === shownTab)}
          sources={shownTab === ALL || shownTab === SIDE_BY_SIDE ? sources : undefined}
          emptyText={emptyText}
        />
      )}

      <ChatComposer sources={sources} target={target} onTargetChange={setTarget} />
    </div>
  );
}

/**
 * Messages that stay scrolled to the newest while reading along, and are left alone when scrolled up to read back,
 * with a button back down. Given `sources`, each message says which chat it's from.
 */
function ChatFeed({ messages, sources, emptyText }: { messages: ChatMessage[]; sources?: ChatSource[]; emptyText: string }) {
  const [following, setFollowing] = useState(true);
  const feed = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (following && feed.current) feed.current.scrollTop = feed.current.scrollHeight;
  }, [messages, following]);

  // A platform's chats are told apart by name only when it has more than one
  const perPlatform = (source: ChatSource) => sources?.filter((other) => other.platform === source.platform).length ?? 0;

  return (
    <div className='relative flex min-h-0 flex-1 flex-col'>
      <div
        ref={feed}
        onScroll={(event) => {
          const element = event.currentTarget;
          setFollowing(element.scrollHeight - element.scrollTop - element.clientHeight <= FOLLOW_SLACK_PX);
        }}
        className='bg-card min-h-0 flex-1 overflow-y-auto rounded-xl border p-2'
      >
        {messages.length ? (
          <ul className='flex flex-col'>
            {messages.map((message) => {
              const source = sources?.find((known) => known.id === message.source);
              return (
                <ChatMessageRow
                  key={message.id}
                  message={message}
                  source={source}
                  showSource={!sources ? 'none' : source && perPlatform(source) > 1 ? 'name' : 'icon'}
                />
              );
            })}
          </ul>
        ) : (
          <p className='text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm text-balance'>{emptyText}</p>
        )}
      </div>
      {!following && (
        <Button size='sm' variant='secondary' className='absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md' onClick={() => setFollowing(true)}>
          <ArrowDownIcon aria-hidden='true' />
          Latest messages
        </Button>
      )}
    </div>
  );
}

/** Whether a chat is connected, as a colored dot, with the reason on hover when it isn't. */
function StateDot({ source }: { source: ChatSource }) {
  return (
    <span
      className={cn(
        'size-2 shrink-0 rounded-full',
        source.state === 'connected' && 'bg-emerald-500',
        source.state === 'connecting' && 'bg-muted-foreground animate-pulse',
        source.state === 'problem' && 'bg-destructive',
      )}
      title={source.state === 'connected' ? 'Connected' : source.state === 'connecting' ? 'Connecting' : source.problem}
    />
  );
}

function TabButton({ current, onClick, children }: { current: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type='button' size='sm' variant={current ? 'default' : 'outline'} aria-pressed={current} onClick={onClick}>
      {children}
    </Button>
  );
}
