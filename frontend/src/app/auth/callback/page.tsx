'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { setToken } from '@/lib/api';

function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const token = params.get('token');
    if (token) setToken(token);
    router.replace('/');
  }, [params, router]);
  return <p className="slds-p-around_large">Signing you in…</p>;
}

export default function CallbackPage() {
  return <Suspense fallback={<p className="slds-p-around_large">Signing you in…</p>}><Callback /></Suspense>;
}
