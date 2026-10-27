'use client';

import { Loader2Icon, SearchIcon, XIcon } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';

import { searchCategories } from '@/lib/actions';
import type { Category } from '@/lib/schemas';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** How long typing has to pause before searching, so each key doesn't ask Twitch. */
const SEARCH_DELAY = 250;

function BoxArt({ category, className }: { category: Category; className?: string }) {
  if (!category.boxArt) return <div className={`bg-muted shrink-0 rounded ${className}`} />;
  // Twitch's CDN already serves it small; optimizing it again would only add a round trip.
  return <Image src={category.boxArt} alt='' width={52} height={72} unoptimized className={`bg-muted shrink-0 rounded object-cover ${className}`} />;
}

/** The stream's Twitch category: the one set, or a search for another. */
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

  function choose(category: Category) {
    onChange(category);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  if (value && !open) {
    return (
      <div className='flex items-center gap-3 rounded-md border p-2'>
        <BoxArt category={value} className='h-12 w-9' />
        <span className='flex-1 font-medium'>{value.name}</span>
        <Button type='button' variant='outline' size='sm' id={id} onClick={() => setOpen(true)}>
          <SearchIcon aria-hidden='true' />
          Change
        </Button>
        <Button type='button' variant='ghost' size='icon-sm' onClick={() => onChange(null)} aria-label='Remove the category'>
          <XIcon aria-hidden='true' />
        </Button>
      </div>
    );
  }

  const typed = query.trim();
  const shown = typed ? results : [];

  return (
    <div className='relative'>
      <SearchIcon className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' aria-hidden='true' />
      <Input
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
            setQuery('');
            setOpen(false);
          }
        }}
        onBlur={(event) => {
          // Picking from the list moves focus into it first; only leaving the picker altogether closes it.
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setOpen(false);
        }}
        className='pr-8 pl-8'
      />
      {searching && <Loader2Icon className='text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin' aria-hidden='true' />}
      {typed && !searching && (problem || !shown.length) && (
        <p className='text-muted-foreground mt-1.5 text-sm'>{problem ?? `No category matches "${typed}".`}</p>
      )}
      {!!shown.length && (
        <ul id={listId} role='listbox' className='bg-popover absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border p-1 shadow-md'>
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
  );
}
