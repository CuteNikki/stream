'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { MAX_NAME_LENGTH } from '@/constants/auth';
import { updateName } from '@/lib/actions';
import { updateNameSchema } from '@/lib/schemas';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2Icon, PencilLineIcon } from 'lucide-react';

export function NameForm({ name }: { name: string }) {
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<z.infer<typeof updateNameSchema>>({
    resolver: zodResolver(updateNameSchema),
    defaultValues: { name },
  });
  const typed = useWatch({ control: form.control, name: 'name' }).trim();

  async function onSubmit(data: z.infer<typeof updateNameSchema>) {
    setIsSaving(true);
    const result = await updateName(data);

    if (result) {
      toast.error(result.message, { duration: 5000, position: 'top-center' });
      setIsSaving(false);
      return;
    }

    toast.success('Name updated.', { duration: 5000, position: 'top-center' });
    setIsSaving(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='flex flex-col gap-2 sm:flex-row sm:items-end'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem className='flex-1'>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete='name' maxLength={MAX_NAME_LENGTH} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit' disabled={isSaving || !typed || typed === name}>
          {isSaving ? (
            <>
              <Loader2Icon className='shrink-0 animate-spin' aria-hidden='true' />
              Updating...
            </>
          ) : (
            <>
              <PencilLineIcon className='shrink-0' aria-hidden='true' />
              Change
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
