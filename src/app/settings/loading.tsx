import { PageLoading } from '@/components/common/page-loading';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <PageLoading eyebrow='Your account' title='Settings'>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className='h-40 rounded-2xl' />
        ))}
      </div>
    </PageLoading>
  );
}
