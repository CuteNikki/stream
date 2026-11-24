'use client';

import { ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { useId, useState } from 'react';

import type { YouTubeBroadcast } from '@/lib/youtube';

import { LocalTime } from '@/components/common/local-time';
import { ThumbnailUpload } from '@/components/stream/thumbnail-upload';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * The YouTube streams live or coming up, each ticked to have a save go to it: say the stream and the relay's
 * vertical copy of it, live at once on their own stream keys.
 */
export function BroadcastPicker({ broadcasts, value, onChange }: { broadcasts: YouTubeBroadcast[]; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <ul className='flex flex-col gap-2'>
      {broadcasts.map((broadcast) => (
        <BroadcastRow
          key={broadcast.id}
          broadcast={broadcast}
          ticked={value.includes(broadcast.id)}
          onTick={(ticked) => onChange(ticked ? [...value, broadcast.id] : value.filter((id) => id !== broadcast.id))}
        />
      ))}
    </ul>
  );
}

function BroadcastRow({ broadcast, ticked, onTick }: { broadcast: YouTubeBroadcast; ticked: boolean; onTick: (ticked: boolean) => void }) {
  const [thumbnail, setThumbnail] = useState(broadcast.thumbnail);
  const id = useId();

  // One row from sm up; on phones the title gets the width, with the thumbnail beside its button below
  return (
    <li className='grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]'>
      <Checkbox id={id} checked={ticked} onCheckedChange={(checked) => onTick(checked === true)} />
      <label htmlFor={id} className='flex min-w-0 cursor-pointer flex-col gap-1 sm:col-start-3 sm:row-start-1'>
        <span title={broadcast.title} className='line-clamp-2 text-sm font-medium wrap-break-word sm:line-clamp-1'>
          {broadcast.title}
        </span>
        <span className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm'>
          {broadcast.live ? <Badge variant='destructive'>Live</Badge> : <Badge variant='secondary'>Coming up</Badge>}
          {broadcast.streamKey && <span className='truncate'>{broadcast.streamKey.name}</span>}
          {broadcast.start && <LocalTime iso={broadcast.start} />}
        </span>
      </label>
      <div className='col-span-2 flex items-center justify-between gap-3 sm:contents'>
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=''
            width={160}
            height={90}
            unoptimized
            className='bg-muted aspect-video w-24 shrink-0 rounded-md object-cover sm:col-start-2 sm:row-start-1'
          />
        ) : (
          <div className='bg-muted text-muted-foreground flex aspect-video w-24 shrink-0 items-center justify-center rounded-md sm:col-start-2 sm:row-start-1'>
            <ImageIcon className='size-5' aria-hidden='true' />
          </div>
        )}
        <div className='sm:col-start-4 sm:row-start-1'>
          <ThumbnailUpload broadcastId={broadcast.id} onUploaded={setThumbnail} />
        </div>
      </div>
    </li>
  );
}
