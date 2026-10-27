import { PageLoading } from '@/components/common/page-loading';
import { Skeleton } from '@/components/ui/skeleton';

export default function StreamLoading() {
  return (
    <PageLoading eyebrow='Your stream' title='Stream' description='Set what your stream is called, and what it is, on every platform at once.'>
      <Skeleton className='h-64 rounded-2xl' />
    </PageLoading>
  );
}
