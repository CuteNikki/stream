import { PageLoading } from '@/components/common/page-loading';
import { Skeleton } from '@/components/ui/skeleton';

/** Shaped like the chat as it first shows: the All tab, the feed, and the message row under it. */
export default function ChatLoading() {
  return (
    <PageLoading eyebrow='Your chat' title='Chat' description="Every platform's chat as it happens: together, side by side, or one at a time." fill>
      <div className='flex min-h-0 flex-1 flex-col gap-3'>
        <Skeleton className='h-8 w-16 shrink-0 rounded-md' />
        <Skeleton className='min-h-72 flex-1 rounded-xl' />
        <div className='flex shrink-0 flex-col gap-2 sm:flex-row'>
          <Skeleton className='h-9 w-full rounded-md sm:w-48' />
          <Skeleton className='h-9 rounded-md sm:flex-1' />
        </div>
      </div>
    </PageLoading>
  );
}
