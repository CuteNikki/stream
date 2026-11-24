'use client';

import { ImageUpIcon, Loader2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { MAX_THUMBNAIL_SIZE, THUMBNAIL_TYPES } from '@/constants/stream';
import { uploadThumbnail } from '@/lib/actions';

import { Button } from '@/components/ui/button';

/** Puts a new thumbnail on one YouTube stream straight away, apart from saving the rest. */
export function ThumbnailUpload({ broadcastId, onUploaded }: { broadcastId: string; onUploaded: (thumbnail: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function upload(image: File) {
    if (!THUMBNAIL_TYPES.includes(image.type)) return void toast.error('Thumbnails have to be a JPG or PNG.', { duration: 5000, position: 'top-center' });
    if (image.size > MAX_THUMBNAIL_SIZE) return void toast.error('Thumbnails can be at most 2 MB.', { duration: 5000, position: 'top-center' });

    setIsUploading(true);
    const data = new FormData();
    data.set('broadcast', broadcastId);
    data.set('thumbnail', image);
    const result = await uploadThumbnail(data);
    setIsUploading(false);

    if ('message' in result) return void toast.error(result.message, { duration: 10000, position: 'top-center' });
    // YouTube keeps the address, so the browser would show the old one from its cache
    if (result.thumbnail) onUploaded(`${result.thumbnail}?v=${Date.now()}`);
    toast.success('Thumbnail updated on YouTube.', { duration: 5000, position: 'top-center' });
  }

  return (
    <>
      <Button type='button' variant='outline' size='sm' disabled={isUploading} onClick={() => input.current?.click()}>
        {isUploading ? <Loader2Icon className='animate-spin' aria-hidden='true' /> : <ImageUpIcon aria-hidden='true' />}
        Thumbnail
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
    </>
  );
}
