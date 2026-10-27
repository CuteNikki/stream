'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon, SaveIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { MAX_TITLE_LENGTH } from '@/constants/stream';
import { updateStream } from '@/lib/actions';
import { providerLabel, type PlatformId } from '@/lib/providers';
import { streamSchema, type StreamDetails } from '@/lib/schemas';

import { ProviderIcon } from '@/components/common/provider-icon';
import { CategoryPicker } from '@/components/stream/category-picker';
import { TagInput } from '@/components/stream/tag-input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

/** The stream's title, category and tags, saved to every platform listed. */
export function StreamForm({ details, platforms }: { details: StreamDetails; platforms: PlatformId[] }) {
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<StreamDetails>({
    resolver: zodResolver(streamSchema),
    defaultValues: details,
  });
  const title = useWatch({ control: form.control, name: 'title' });

  async function onSubmit(data: StreamDetails) {
    setIsSaving(true);
    const result = await updateStream(data);
    setIsSaving(false);

    if ('message' in result) return void toast.error(result.message, { duration: 5000, position: 'top-center' });

    for (const platform of result.results) {
      const label = providerLabel(platform.platform);
      if (platform.ok) toast.success(`Updated on ${label}.`, { duration: 5000, position: 'top-center' });
      else toast.error(platform.message, { description: `${label} wasn't updated.`, duration: 10000, position: 'top-center' });
    }
    // What went through is what's set now; a platform that failed is saved again next time anyway.
    if (result.results.some((platform) => platform.ok)) form.reset(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='flex flex-col gap-5'>
        <FormField
          control={form.control}
          name='title'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input autoComplete='off' maxLength={MAX_TITLE_LENGTH} {...field} />
              </FormControl>
              <FormDescription className='flex justify-end tabular-nums'>
                {title.length}/{MAX_TITLE_LENGTH}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='category'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <CategoryPicker value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='tags'
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl>
                <TagInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={fieldState.invalid} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
            Saves to
            {platforms.map((platform) => (
              <span key={platform} className='text-foreground inline-flex items-center gap-1.5 font-medium'>
                <ProviderIcon provider={platform} className='size-4' />
                {providerLabel(platform)}
              </span>
            ))}
          </p>
          <Button type='submit' disabled={isSaving || !form.formState.isDirty}>
            {isSaving ? (
              <>
                <Loader2Icon className='shrink-0 animate-spin' aria-hidden='true' />
                Saving...
              </>
            ) : (
              <>
                <SaveIcon className='shrink-0' aria-hidden='true' />
                Save
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
