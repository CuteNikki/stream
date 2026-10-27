'use client';

import { ImageIcon, ImageUpIcon, Loader2Icon } from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { MAX_THUMBNAIL_SIZE, THUMBNAIL_TYPES } from '@/constants/stream';
import { uploadThumbnail } from '@/lib/actions';

import { Button } from '@/components/ui/button';

/** The YouTube stream's thumbnail, and a new one put on straight away, apart from saving the rest. */
export function ThumbnailUpload({ thumbnail }: { thumbnail: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(thumbnail);
  const [isUploading, setIsUploading] = useState(false);

  async function upload(image: File) {
    if (!THUMBNAIL_TYPES.includes(image.type)) return void toast.error('Thumbnails have to be a JPG or PNG.', { duration: 5000, position: 'top-center' });
    if (image.size > MAX_THUMBNAIL_SIZE) return void toast.error('Thumbnails can be at most 2 MB.', { duration: 5000, position: 'top-center' });

    setIsUploading(true);
    const data = new FormData();
    data.set('thumbnail', image);
    const result = await uploadThumbnail(data);
    setIsUploading(false);

    if ('message' in result) return void toast.error(result.message, { duration: 10000, position: 'top-center' });
    // YouTube keeps the address, so the browser would show the old one from its cache
    if (result.thumbnail) setCurrent(`${result.thumbnail}?v=${Date.now()}`);
    toast.success('Thumbnail updated on YouTube.', { duration: 5000, position: 'top-center' });
  }

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
      {current ? (
        <Image src={current} alt='The current thumbnail' width={320} height={180} unoptimized className='bg-muted aspect-video w-64 rounded-md object-cover' />
      ) : (
        <div className='bg-muted text-muted-foreground flex aspect-video w-64 items-center justify-center rounded-md'>
          <ImageIcon className='size-6' aria-hidden='true' />
        </div>
      )}
      <div className='flex flex-col items-start gap-2'>
        <p className='text-muted-foreground text-sm'>A JPG or PNG of up to 2 MB, at 1280x720 for the sharpest. It goes on as soon as it&apos;s picked.</p>
        <Button type='button' variant='outline' size='sm' disabled={isUploading} onClick={() => input.current?.click()}>
          {isUploading ? <Loader2Icon className='animate-spin' aria-hidden='true' /> : <ImageUpIcon aria-hidden='true' />}
          {isUploading ? 'Uploading...' : 'Upload new'}
        </Button>
        <input
          ref={input}
          type='file'
          accept={THUMBNAIL_TYPES.join(',')}
          className='hidden'
          onChange={(event) => {
            const image = event.target.files?.[0];
            event.target.value = '';
            if (image) upload(image);
          }}
        />
      </div>
    </div>
  );
}
