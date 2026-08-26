import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <Link href="/" className="font-heading text-lg font-bold tracking-wide">
        QR<span className="text-accent">4</span>LIFE
      </Link>
      <div className="mt-8 w-full max-w-sm rounded-lg border border-line bg-white p-8">{children}</div>
    </div>
  );
}
