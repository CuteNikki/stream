'use client';

import { Loader2Icon, SearchIcon, XIcon } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';

import { searchCategories } from '@/lib/actions';
import type { Category } from '@/lib/schemas';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';

/** How long typing has to pause before searching, so each key doesn't ask Twitch. */
const SEARCH_DELAY = 250;

function BoxArt({ category, className }: { category: Category; className?: string }) {
  if (!category.boxArt) return <div className={cn('bg-muted shrink-0 rounded', className)} />;
  // Twitch's CDN already serves it small; optimizing it again would only add a round trip.
  return <Image src={category.boxArt} alt='' width={52} height={72} unoptimized className={cn('bg-muted shrink-0 rounded object-cover', className)} />;
}

/**
 * The stream's Twitch category: the one set, or a search for another. Both are the same box, the box art's
 * place kept while searching, so changing it doesn't move what's below.
 */
export function CategoryPicker({ id, value, onChange }: { id?: string; value: Category | null; onChange: (category: Category | null) => void }) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Category[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Only the latest search's answer is shown, whichever comes back first.
  const latest = useRef(0);
  const picker = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const typed = query.trim();
    if (!typed) return;

    const search = ++latest.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await searchCategories(typed);
      if (search !== latest.current) return;
      setSearching(false);
      setActive(0);
      if ('message' in result) {
        setProblem(result.message);
        setResults([]);
      } else {
        setProblem(null);
        setResults(result.categories);
      }
    }, SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [query]);

  function close() {
    setQuery('');
    setResults([]);
    setProblem(null);
    setOpen(false);
  }

  function choose(category: Category) {
    onChange(category);
    close();
  }

  // With nothing set there's nothing else to show, so it's searching already.
  const editing = open || !value;
  const typed = query.trim();
  const shown = typed ? results : [];
  const message = typed && !searching && !shown.length ? (problem ?? `No category matches "${typed}".`) : null;

  return (
    <div
      ref={picker}
      className='relative'
      onBlur={() => {
        // Only leaving the picker altogether closes it: picking from the list moves focus into it first, and
        // Change hands it to the search box. Looked at a frame later, once focus has landed.
        requestAnimationFrame(() => {
          if (!picker.current?.contains(document.activeElement)) close();
        });
      }}
    >
      <div
        className={cn(
          'border-input dark:bg-input/30 flex items-center gap-3 rounded-md border p-2 shadow-xs transition-[color,box-shadow]',
          editing && 'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        )}
      >
        {value ? (
          <BoxArt category={value} className={cn('h-12 w-9 transition-opacity', editing && 'opacity-40')} />
        ) : (
          <div className='bg-muted text-muted-foreground flex h-12 w-9 shrink-0 items-center justify-center rounded'>
            <SearchIcon className='size-4' aria-hidden='true' />
          </div>
        )}
        {editing ? (
          <input
            id={id}
            role='combobox'
            aria-expanded={!!shown.length}
            aria-controls={listId}
            aria-activedescendant={shown.length ? `${listId}-${active}` : undefined}
            aria-autocomplete='list'
            autoComplete='off'
            autoFocus={open}
            placeholder='Search Twitch categories'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && shown.length) {
                event.preventDefault();
                setActive((active + 1) % shown.length);
              } else if (event.key === 'ArrowUp' && shown.length) {
                event.preventDefault();
                setActive((active - 1 + shown.length) % shown.length);
              } else if (event.key === 'Enter' && shown[active]) {
                event.preventDefault();
                choose(shown[active]);
              } else if (event.key === 'Escape') {
                close();
              }
            }}
            className='placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm'
          />
        ) : (
          <span className='min-w-0 flex-1 truncate font-medium'>{value?.name}</span>
        )}
        {searching && <Loader2Icon className='text-muted-foreground size-4 shrink-0 animate-spin' aria-hidden='true' />}
        {!editing ? (
          <>
            <Button type='button' variant='outline' size='sm' id={id} onClick={() => setOpen(true)}>
              <SearchIcon aria-hidden='true' />
              Change
            </Button>
            <Button type='button' variant='ghost' size='icon-sm' onClick={() => onChange(null)} aria-label='Remove the category'>
              <XIcon aria-hidden='true' />
            </Button>
          </>
        ) : (
          value && (
            <Button type='button' variant='ghost' size='sm' onClick={close}>
              Cancel
            </Button>
          )
        )}
      </div>
      {(!!shown.length || message) && (
        <div className='bg-popover absolute inset-x-0 top-full z-20 mt-1 rounded-md border p-1 shadow-md'>
          {message ? (
            <p className='text-muted-foreground p-1.5 text-sm'>{message}</p>
          ) : (
            <ul id={listId} role='listbox' className='max-h-80 overflow-y-auto'>
              {shown.map((category, index) => (
                <li
                  key={category.id}
                  id={`${listId}-${index}`}
                  role='option'
                  aria-selected={index === active}
                  tabIndex={-1}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(category)}
                  className='aria-selected:bg-accent flex cursor-pointer items-center gap-3 rounded-sm p-1.5 text-sm'
                >
                  <BoxArt category={category} className='h-10 w-7.5' />
                  {category.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
