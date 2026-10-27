'use client';

import { XIcon } from 'lucide-react';
import { useState } from 'react';

import { MAX_TAG_LENGTH, MAX_TAGS } from '@/constants/stream';
import { tagSchema } from '@/lib/schemas';
import { cn } from '@/lib/utils';

/**
 * Tags as chips: typing one and pressing Enter, a comma or a space adds it, and Backspace in the empty box takes
 * the last one off. A tag Twitch would turn away says why instead of being added.
 */
export function TagInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
}: {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const full = value.length >= MAX_TAGS;

  function add() {
    if (!typed.trim()) return true;
    const parsed = tagSchema.safeParse(typed);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0].message);
      return false;
    }
    if (value.some((tag) => tag.toLowerCase() === parsed.data.toLowerCase())) {
      setProblem('That tag is already there.');
      return false;
    }
    onChange([...value, parsed.data]);
    setTyped('');
    return true;
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <div
        className={cn(
          'border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]',
          (invalid || problem) && 'border-destructive ring-destructive/20 dark:ring-destructive/40',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className='bg-primary/15 text-primary-strong dark:bg-primary/20 inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-sm font-medium'
          >
            {tag}
            <button
              type='button'
              onClick={() => onChange(value.filter((other) => other !== tag))}
              className='hover:bg-primary/20 focus-visible:ring-ring/50 rounded-full p-0.5 outline-none focus-visible:ring-[3px]'
              aria-label={`Remove ${tag}`}
            >
              <XIcon className='size-3.5' aria-hidden='true' />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={typed}
          disabled={full}
          maxLength={MAX_TAG_LENGTH + 1}
          placeholder={full ? `That's ${MAX_TAGS}, the most there can be` : value.length ? 'Add another' : 'Add a tag'}
          aria-invalid={invalid || !!problem}
          onChange={(event) => {
            setTyped(event.target.value);
            setProblem(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
              // Enter would save the form; a tag that's still being typed is added first, and saving waits for a second Enter.
              if (event.key !== 'Enter' || typed.trim()) event.preventDefault();
              add();
            } else if (event.key === 'Backspace' && !typed && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            add();
            onBlur?.();
          }}
          className='placeholder:text-muted-foreground min-w-32 flex-1 bg-transparent py-0.5 text-base outline-none disabled:cursor-not-allowed md:text-sm'
        />
      </div>
      {problem && <p className='text-destructive text-sm'>{problem}</p>}
    </div>
  );
}
