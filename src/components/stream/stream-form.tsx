'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon, SaveIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import {
  CONTENT_LABELS,
  CONTENT_LABELS_GUIDE,
  LANGUAGES,
  MAX_TITLE_LENGTH,
  MAX_YOUTUBE_DESCRIPTION_LENGTH,
  MAX_YOUTUBE_TITLE_LENGTH,
  YOUTUBE_CATEGORIES,
  YOUTUBE_VISIBILITIES,
} from '@/constants/stream';
import { updateStream } from '@/lib/actions';
import { providerLabel, type PlatformId } from '@/lib/providers';
import { streamSchema, type StreamDetails } from '@/lib/schemas';
import type { YouTubeBroadcast } from '@/lib/youtube';

import { ProviderIcon } from '@/components/common/provider-icon';
import { CategoryPicker } from '@/components/stream/category-picker';
import { TagInput } from '@/components/stream/tag-input';
import { ThumbnailUpload } from '@/components/stream/thumbnail-upload';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/**
 * A part of the form: what's set everywhere, or on one platform. Each after the first is set off by a line, and
 * says which platforms it's for.
 */
function FormSection({
  id,
  title,
  platforms,
  note,
  children,
}: {
  id: string;
  title: string;
  platforms: PlatformId[];
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className='border-foreground/10 flex flex-col gap-5 not-first:border-t not-first:pt-5'>
      <h3 id={`${id}-heading`} className='flex flex-wrap items-center gap-x-2 gap-y-1 font-bold'>
        <span className='flex items-center gap-1.5'>
          {platforms.map((platform) => (
            <ProviderIcon key={platform} provider={platform} className='size-5' />
          ))}
        </span>
        {title}
        {note && <span className='text-sm'>{note}</span>}
      </h3>
      {children}
    </section>
  );
}

/** Where a save lands on YouTube, which is a broadcast and not the channel. */
function YouTubeTarget({ broadcast }: { broadcast: YouTubeBroadcast | null }) {
  if (!broadcast) return <span className='text-destructive font-normal'>No stream coming up</span>;
  return <span className='text-muted-foreground font-normal'>{broadcast.live ? 'The live stream' : 'The next stream'}</span>;
}

/** The stream's details, saved to every platform listed. */
export function StreamForm({
  details,
  matureGame,
  platforms,
  youtube,
}: {
  details: StreamDetails;
  /** Whether Twitch labels the category mature, which only the category changes. */
  matureGame: boolean;
  platforms: PlatformId[];
  /** The broadcast a save sets on YouTube, if YouTube's connected. */
  youtube?: { broadcast: YouTubeBroadcast | null };
}) {
  const [isSaving, setIsSaving] = useState(false);
  // A language Twitch has that the list doesn't still shows, by its code, rather than an empty box.
  const languages = LANGUAGES.some((language) => language.code === details.language)
    ? LANGUAGES
    : [...LANGUAGES, { code: details.language, name: details.language }];
  const hasYouTube = platforms.includes('google');
  const hasTwitch = platforms.includes('twitch');
  const titleLimit = hasYouTube ? MAX_YOUTUBE_TITLE_LENGTH : MAX_TITLE_LENGTH;
  const form = useForm<StreamDetails>({
    resolver: zodResolver(
      streamSchema.extend({
        title: streamSchema.shape.title.max(titleLimit, `Title must be at most ${titleLimit} characters${hasYouTube ? ', for YouTube' : ''}.`),
      }),
    ),
    defaultValues: details,
  });
  const title = useWatch({ control: form.control, name: 'title' });
  const description = useWatch({ control: form.control, name: 'youtube.description' });

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
        <FormSection
          id='everywhere'
          title='Everywhere'
          platforms={platforms}
          note={platforms.length > 1 && <span className='text-muted-foreground font-normal'>Set on every platform at once</span>}
        >
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
                  {title.length}/{titleLimit}
                </FormDescription>
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
          <FormField
            control={form.control}
            name='language'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Language</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className='w-full sm:w-64'>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {languages.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='brandedContent'
            render={({ field }) => (
              <FormItem>
                <FormLabel asChild>
                  <span>Branded content</span>
                </FormLabel>
                <label className='flex cursor-pointer items-start gap-2 text-sm'>
                  <Checkbox className='mt-0.5' checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  The stream has paid product placement, an endorsement, or another commercial relationship.
                </label>
              </FormItem>
            )}
          />
        </FormSection>
        {hasTwitch && (
          <FormSection id='twitch' title='Twitch' platforms={['twitch']}>
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
              name='labels'
              render={({ field }) => (
                <FormItem>
                  <FormLabel asChild>
                    <span>Content labels</span>
                  </FormLabel>
                  <FormDescription>
                    What viewers should know before watching.{' '}
                    <a href={CONTENT_LABELS_GUIDE} target='_blank' rel='noreferrer' className='text-primary underline-offset-4 hover:underline'>
                      What each covers
                    </a>
                  </FormDescription>
                  <div className='grid gap-2.5 pt-1 sm:grid-cols-2'>
                    {CONTENT_LABELS.map((label) => (
                      <label key={label.id} className='flex cursor-pointer items-start gap-2 text-sm'>
                        <Checkbox
                          className='mt-0.5'
                          checked={field.value.includes(label.id)}
                          onCheckedChange={(checked) => field.onChange(checked ? [...field.value, label.id] : field.value.filter((id) => id !== label.id))}
                        />
                        {label.name}
                      </label>
                    ))}
                    {matureGame && (
                      <label className='text-muted-foreground flex items-start gap-2 text-sm'>
                        <Checkbox className='mt-0.5' checked disabled />
                        Mature-rated game, set by the category
                      </label>
                    )}
                  </div>
                </FormItem>
              )}
            />
          </FormSection>
        )}
        {details.youtube && (
          <FormSection id='youtube' title='YouTube' platforms={['google']} note={youtube && <YouTubeTarget broadcast={youtube.broadcast} />}>
            <FormField
              control={form.control}
              name='youtube.category'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className='w-full sm:w-64'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {YOUTUBE_CATEGORIES.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>YouTube&apos;s broad ones. The game itself can only be picked in YouTube Studio.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='youtube.description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={5} maxLength={MAX_YOUTUBE_DESCRIPTION_LENGTH} className='max-h-96' {...field} />
                  </FormControl>
                  <FormDescription className='flex justify-end tabular-nums'>
                    {description?.length ?? 0}/{MAX_YOUTUBE_DESCRIPTION_LENGTH}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='youtube.visibility'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className='w-full sm:w-64'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {YOUTUBE_VISIBILITIES.map((visibility) => (
                        <SelectItem key={visibility.id} value={visibility.id}>
                          {visibility.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{YOUTUBE_VISIBILITIES.find((visibility) => visibility.id === field.value)?.note}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='youtube.madeForKids'
              render={({ field }) => (
                <FormItem>
                  <FormLabel asChild>
                    <span>Audience</span>
                  </FormLabel>
                  <label className='flex cursor-pointer items-start gap-2 text-sm'>
                    <Checkbox className='mt-0.5' checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                    Made for kids. YouTube then turns off live chat, comments and personalised ads.
                  </label>
                </FormItem>
              )}
            />
            {youtube?.broadcast && (
              <div className='flex flex-col gap-2'>
                <p className='text-sm font-medium'>Thumbnail</p>
                <ThumbnailUpload thumbnail={youtube.broadcast.thumbnail} />
              </div>
            )}
          </FormSection>
        )}
        <div className='border-foreground/10 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between'>
          {/* Each part's heading says where it goes; this only says one button saves them all. */}
          <p className='text-muted-foreground text-sm'>
            {platforms.length > 1 ? 'Saves every part above at once, each to its own platforms.' : 'Saves everything above.'}
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
