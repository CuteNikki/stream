import type { Metadata } from 'next';

import { settingsMetadata } from '@/constants/metadata';
import { getAccountSettings } from '@/lib/account';
import { requireUser } from '@/lib/session';

import { EmailSettings } from '@/components/account/email-settings';
import { NameForm } from '@/components/account/name-form';
import { PasskeySettings } from '@/components/account/passkey-settings';
import { PasswordForm } from '@/components/account/password-form';
import { SessionList } from '@/components/account/session-list';
import { TwoFactorSettings } from '@/components/account/two-factor-settings';
import { PageShell } from '@/components/common/page-shell';
import { SettingsSection } from '@/components/common/settings-section';

export const metadata: Metadata = settingsMetadata;

export default async function SettingsPage() {
  const { user, session } = await requireUser();
  const { hasPassword, twoFactor, trustedDevices, passkeys, sessions } = await getAccountSettings({
    userId: user.id,
    sessionId: session.id,
  });

  return (
    <PageShell eyebrow='Your account' title='Settings'>
      <div className='grid grid-cols-1 items-start gap-6 lg:grid-cols-2'>
        <div className='grid grid-cols-1 gap-6'>
          <SettingsSection title='Name'>
            <NameForm name={user.name} />
          </SettingsSection>
          <SettingsSection title='Email' description='Where sign-in codes and links to reset your password go.'>
            <EmailSettings email={user.email} verified={user.emailVerified} />
          </SettingsSection>
          <SettingsSection title='Password'>
            <PasswordForm hasPassword={hasPassword} />
          </SettingsSection>
        </div>
        <div className='grid grid-cols-1 gap-6'>
          <SettingsSection title='Two-step sign-in'>
            <TwoFactorSettings method={twoFactor} hasPassword={hasPassword} trustedDevices={trustedDevices} />
          </SettingsSection>
          <SettingsSection
            title='Passkeys'
            description='Sign in with your fingerprint, face or device PIN instead of a password. Passkeys only work on the device that made them, or the ones it syncs with.'
          >
            <PasskeySettings passkeys={passkeys} />
          </SettingsSection>
        </div>
        <SettingsSection title='Sessions' description='Everywhere you are signed in right now.' className='lg:col-span-2'>
          <SessionList sessions={sessions} />
        </SettingsSection>
      </div>
    </PageShell>
  );
}
