import 'server-only';

/**
 * Where the site runs, e.g. https://stream.example.com. Links in emails, the
 * platforms' sign-in callbacks and passkeys all use it. Read when the server
 * starts, unlike NEXT_PUBLIC_ values, which are fixed when the app is built.
 * Only local development may leave BETTER_AUTH_URL out.
 */
function readSiteURL() {
  const { BETTER_AUTH_URL } = process.env;

  if (BETTER_AUTH_URL) return new URL(BETTER_AUTH_URL);
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('BETTER_AUTH_URL is not set. Set it to the public address of the site, e.g. https://stream.example.com.');
  }
  return new URL('http://localhost:3000');
}

export const siteURL = readSiteURL();
