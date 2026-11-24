'use client';

import { Loader2Icon, LinkIcon, RefreshCwIcon, UnlinkIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { authClient, recentSignInMessage } from '@/lib/auth-client';
import { hasAllScopes, PLATFORMS, providerLabel, socialErrorMessage, type PlatformId } from '@/lib/providers';

import { useConfirm } from '@/components/common/confirm-dialog';
import { ProviderIcon } from '@/components/common/provider-icon';
import { Button } from '@/components/ui/button';

const PLATFORM_IDS = new Set<string>(PLATFORMS.map((platform) => platform.id));

/**
 * The platforms stream changes your stream on: connect one to let it, or
 * disconnect it to stop it. Connecting signs in to the platform, which asks
 * whether Stream may.
 */
export function PlatformList({
  platforms,
  accounts,
  error,
}: {
  /** Platforms set up on this site, with their client id and secret. */
  platforms: PlatformId[];
  /** What's connected to this account, as well as `credential`, the password, with what each was allowed. */
  accounts: { id: string; providerId: string; scope: string | null }[];
  /** Set by Better Auth when connecting fails and it redirects back here. */
  error?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [ask, confirmDialog] = useConfirm();

  useEffect(() => {
    if (!error) return;
    toast.error(socialErrorMessage(error), { duration: 5000, position: 'top-center' });
    router.replace('/platforms');
  }, [error, router]);

  // Connected ones stay listed after they're turned off here, so they can
  // still be disconnected.
  const connected = accounts.filter((account) => account.providerId !== 'credential');
  const shown = [...new Set<string>([...platforms, ...connected.map((account) => account.providerId)])];

  async function connect(provider: string) {
    setPending(provider);
    const { error } = await authClient.linkSocial({ provider, callbackURL: '/platforms', errorCallbackURL: '/platforms' });
    // On success the browser is sent off to the platform.
    if (error) {
      setPending(null);
      toast.error(error.message ?? `Unable to connect ${providerLabel(provider)}!`, { duration: 5000, position: 'top-center' });
    }
  }

  async function disconnect(account: { id: string; providerId: string; scope: string | null }) {
    const label = providerLabel(account.providerId);
    const confirmed = await ask({
      title: `Disconnect ${label}?`,
      description: `Stream can't change your stream on ${label} anymore, until you connect it again.`,
      action: 'Disconnect',
      destructive: true,
    });
    if (!confirmed) return;

    setPending(`${account.providerId}:disconnect`);
    const { error } = await authClient.unlinkAccount({ accountId: account.id });
    setPending(null);

    if (error) {
      toast.error(recentSignInMessage(error) ?? error.message ?? 'Unable to disconnect!', {
        duration: 5000,
        position: 'top-center',
      });
      return;
    }

    toast.success(`${providerLabel(account.providerId)} disconnected.`, { duration: 5000, position: 'top-center' });
    router.refresh();
  }

  if (!shown.length) {
    return (
      <p className='text-muted-foreground text-sm'>
        No platforms are set up yet. Each needs its client id and secret in Stream&apos;s .env, as TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET (see the README).
      </p>
    );
  }

  return (
    <>
      <ul className='divide-foreground/10 border-foreground/10 flex flex-col divide-y rounded-xl border'>
        {shown.map((provider) => {
          const account = connected.find((account) => account.providerId === provider);
          const label = providerLabel(provider);
          return (
            <li key={provider} className='flex items-center gap-3 p-3 px-4'>
              {PLATFORM_IDS.has(provider) ? (
                <ProviderIcon provider={provider as PlatformId} className='size-5 shrink-0' />
              ) : (
                <LinkIcon className='text-primary size-5 shrink-0' aria-hidden='true' />
              )}
              <span className='flex min-w-0 flex-1 flex-col'>
                <span className='font-medium'>{label}</span>
                {account && !hasAllScopes(provider, account.scope) && (
                  <span className='text-muted-foreground text-sm'>Connect it again to let Stream use its chat too.</span>
                )}
              </span>
              {account ? (
                <span className='flex flex-wrap justify-end gap-2'>
                  {!hasAllScopes(provider, account.scope) && (
                    <Button size='sm' variant='outline' disabled={pending !== null} onClick={() => connect(provider)}>
                      {pending === provider ? <Loader2Icon className='animate-spin' aria-hidden='true' /> : <RefreshCwIcon aria-hidden='true' />}
                      Reconnect
                    </Button>
                  )}
                  <Button variant='destructive' size='sm' disabled={pending !== null} onClick={() => disconnect(account)}>
                    {pending === `${provider}:disconnect` ? <Loader2Icon className='animate-spin' aria-hidden='true' /> : <UnlinkIcon aria-hidden='true' />}
                    Disconnect
                  </Button>
                </span>
              ) : (
                <Button size='sm' variant='outline' disabled={pending !== null} onClick={() => connect(provider)}>
                  {pending === provider ? <Loader2Icon className='animate-spin' aria-hidden='true' /> : <LinkIcon aria-hidden='true' />}
                  Connect
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {confirmDialog}
    </>
  );
}
