import type { Metadata } from 'next';
import { appleConfigured } from '@/lib/auth/apple';
import { AuthForm } from '@/components/auth-form';
import { texts } from '@/lib/i18n/cs';

export const metadata: Metadata = { title: texts.auth.login.title };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const { verified } = await searchParams;
  const banner =
    verified === '1'
      ? texts.auth.login.verifiedBanner
      : verified === '0'
        ? texts.auth.login.verifyFailedBanner
        : null;

  return (
    <>
      {banner && (
        <p
          className={`mb-4 rounded-md px-3 py-2 text-sm ${
            verified === '1' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {banner}
        </p>
      )}
      <AuthForm mode="login" appleEnabled={appleConfigured()} />
    </>
  );
}
