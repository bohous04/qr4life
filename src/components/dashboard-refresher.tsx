'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Obnoví přehled při návratu na kartu a pravidelně — ať jsou skeny vidět hned. */
export function DashboardRefresher() {
  const router = useRouter();

  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const interval = setInterval(onFocus, 30_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
