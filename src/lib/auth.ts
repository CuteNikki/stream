import 'server-only';

import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';
import type { SocialProviders } from 'better-auth/social-providers';
import { after } from 'next/server';

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, PASSWORD_RESET_TOKEN_EXPIRATION, SESSION_EXPIRATION } from '@/constants/auth';
import { sendEmailChangeConfirmation, sendPasswordResetEmail, sendTwoFactorCode, sendVerificationEmail } from '@/lib/email';
import prisma from '@/lib/prisma';
import { PLATFORMS, type PlatformId } from '@/lib/providers';
import { siteURL } from '@/lib/site-url';

/**
 * Where Better Auth keeps the devices that skip two-step sign-in ("Don't ask
 * again"), one verification row each, holding the user's id.
 */
export function trustedDevicesWhere(userId: string) {
  return {
    identifier: { startsWith: 'trust-device-' },
    value: userId,
  };
}

/** Makes every device ask for a code again at the next sign-in. */
export async function forgetTrustedDevices(userId: string) {
  await prisma.verification.deleteMany({ where: trustedDevicesWhere(userId) });
}

/** A platform's client id and secret, when both are set. */
function credentials(id: PlatformId) {
  const clientId = process.env[`${id.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`${id.toUpperCase()}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Platforms with credentials set, so they can be connected. */
export const enabledPlatforms: PlatformId[] = PLATFORMS.map((platform) => platform.id).filter((id) => credentials(id));

// What each platform lets Stream do, asked for when it's connected: changing
// the stream's title and the rest. Google only hands out a refresh token,
// which keeps it connected past an hour, when asked for offline access, and
// only the first time unless it's asked to show its consent screen again.
const platformOptions = {
  twitch: { scope: ['channel:manage:broadcast'] },
  google: {
    scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
    accessType: 'offline',
    prompt: 'select_account consent',
  },
} satisfies Record<PlatformId, object>;

const socialProviders = Object.fromEntries(
  enabledPlatforms.map((id) => [id, { ...credentials(id), ...platformOptions[id], disableSignUp: true }]),
) as SocialProviders;

export const auth = betterAuth({
  baseURL: siteURL.origin,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  session: {
    expiresIn: SESSION_EXPIRATION,
  },
  advanced: {
    cookiePrefix: 'stream',
  },
  socialProviders,
  account: {
    // Platforms' tokens are what lets Stream change your streams, so they
    // never sit in the database readable.
    encryptOAuthTokens: true,
    accountLinking: {
      // Platforms are connected while signed in, from the platforms page, so
      // their email doesn't have to match yours, or exist at all.
      allowDifferentEmails: true,
      trustedProviders: [...PLATFORMS.map((platform) => platform.id)],
    },
  },
  databaseHooks: {
    user: {
      create: {
        // There's only ever the one account: the first, from the setup page.
        // Every way of making one ends here, so none of them gets around it.
        before: async () => {
          if ((await prisma.user.count()) > 0) {
            throw new APIError('FORBIDDEN', { code: 'SIGN_UP_CLOSED', message: 'Stream already has its account.' });
          }
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: PASSWORD_RESET_TOKEN_EXPIRATION,
    sendResetPassword: async ({ user, url }) => {
      // After the response, so its timing doesn't reveal whether the email exists.
      after(() =>
        sendPasswordResetEmail({ email: user.email, name: user.name, url }).catch((error) => console.error('Failed to send password reset email', error)),
      );
    },
  },
  emailVerification: {
    // Sent after setting up, and on request from the settings page.
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      // During an email change, the last link goes to the new address, which
      // no account uses yet. It gets its own wording and landing message.
      const changing = !(await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } }));

      after(() =>
        sendVerificationEmail({
          email: user.email,
          name: user.name,
          url: changing ? withCallback(url, '/verified?step=changed') : url,
          changing,
        }).catch((error) => console.error('Failed to send verification email', error)),
      );
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      // Unverified addresses may have a typo, so they change right away and
      // get a new verification link.
      updateEmailWithoutVerification: true,
      // Verified addresses first confirm from the current address, so a
      // stolen session can't quietly take over the account.
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        after(() =>
          sendEmailChangeConfirmation({
            email: user.email,
            name: user.name,
            newEmail,
            url: withCallback(url, '/verified?step=confirmed'),
          }).catch((error) => console.error('Failed to send email change confirmation', error)),
        );
      },
    },
  },
  rateLimit: {
    // On in production only, per IP address, from the address the reverse
    // proxy passes on. Counted in the database, so a restart doesn't start it
    // over.
    storage: 'database',
    // Sign-in codes are emails, so they get a tighter limit than the default
    // 100 requests per 10 seconds, as does guessing a password.
    customRules: {
      '/two-factor/send-otp': { window: 60, max: 3 },
      '/sign-in/email': { window: 60, max: 10 },
    },
  },
  hooks: {
    // Turning two-step sign-in off forgets every trusted device, not just
    // this one as Better Auth does, so turning it back on asks everywhere.
    after: createAuthMiddleware(async (ctx) => {
      if (isAPIError(ctx.context.returned)) return;
      if (ctx.path === '/two-factor/disable') {
        const session = await getSessionFromCtx(ctx);
        if (session) await forgetTrustedDevices(session.user.id);
      }
    }),
  },
  plugins: [
    // Two-step sign-in, for signing in with a password: a code from an
    // authenticator app or by email, or a backup code. Passkeys are already
    // two steps, so they skip it.
    twoFactor({
      issuer: 'Stream',
      otpOptions: {
        period: 5,
        // Only a hash is kept, like a password.
        storeOTP: 'hashed',
        sendOTP: ({ user, otp }) => {
          after(() =>
            sendTwoFactorCode({ email: user.email, name: user.name, code: otp }).catch((error) => console.error('Failed to send sign-in code', error)),
          );
        },
      },
    }),
    passkey({
      rpID: siteURL.hostname,
      rpName: 'Stream',
      origin: siteURL.origin,
    }),
    // Must be last: lets server actions set auth cookies.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

/** Changes where a Better Auth email link leads once it has been used. */
function withCallback(url: string, callbackURL: string) {
  const link = new URL(url);
  link.searchParams.set('callbackURL', callbackURL);
  return link.toString();
}
