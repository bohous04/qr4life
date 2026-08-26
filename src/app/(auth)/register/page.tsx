import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth-form';
import { texts } from '@/lib/i18n/cs';

export const metadata: Metadata = { title: texts.auth.register.title };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
