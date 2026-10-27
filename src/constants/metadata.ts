import { Metadata } from 'next';

export const SITE_NAME = 'Stream';

/**
 * Shared by every page. It's only ever for its one account, so nothing of it
 * is for search engines.
 */
export const layoutMetadata: Metadata = {
  title: {
    template: `%s · ${SITE_NAME}`,
    default: SITE_NAME,
  },
  description: 'Set the title, category and tags of your stream on every platform at once.',
  applicationName: SITE_NAME,
  robots: { index: false, follow: false },
};

export const homeMetadata: Metadata = {
  title: { absolute: SITE_NAME },
};

export const notFoundMetadata: Metadata = {
  title: 'Not Found',
};

export const setupMetadata: Metadata = {
  title: 'Set Up',
};

export const signInMetadata: Metadata = {
  title: 'Sign In',
};

export const forgotPasswordMetadata: Metadata = {
  title: 'Recovery',
};

export const resetPasswordMetadata: Metadata = {
  title: 'Recovery',
};

export const twoFactorMetadata: Metadata = {
  title: 'Two-Step Sign-In',
};

export const verifiedMetadata: Metadata = {
  title: 'Email Verification',
};

export const platformsMetadata: Metadata = {
  title: 'Platforms',
};

export const settingsMetadata: Metadata = {
  title: 'Settings',
};
