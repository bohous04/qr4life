import { AuthForm } from '@/components/auth-form';

export const metadata = { title: 'Registrace' };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
