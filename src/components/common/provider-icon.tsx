import { siTwitch, siYoutube } from 'simple-icons';

import type { PlatformId } from '@/lib/providers';

// YouTube signs in with Google, but it's YouTube that's shown
const icons: Record<PlatformId, { path: string; hex: string }> = {
  twitch: siTwitch,
  google: siYoutube,
};

/** A platform's logo, in its own color, sized like a Lucide icon. */
export function ProviderIcon({ provider, className }: { provider: PlatformId; className?: string }) {
  const { path, hex } = icons[provider];
  return (
    <svg viewBox='0 0 24 24' className={className} fill={`#${hex}`} aria-hidden='true'>
      <path d={path} />
    </svg>
  );
}
