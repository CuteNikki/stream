import { PageLoading } from '@/components/common/page-loading';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlatformsLoading() {
  return (
    <PageLoading
      eyebrow='Where you stream'
      title='Platforms'
      description='Connect the platforms you stream to, so stream can set your title, category and tags there.'
    >
      <Skeleton className='h-40 rounded-2xl' />
    </PageLoading>
  );
}
