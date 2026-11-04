'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_URL, api, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('avery@salesfroge.local');
  const [password, setPassword] = useState('salesfroge');
  const [error, setError] = useState<string | null>(null);
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('sf_token')) router.replace('/');
    api('/auth/providers').then((providers) => setGoogle(!!providers.google)).catch(() => undefined);
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(result.token);
      router.replace('/');
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="sf-login">
      <form className="slds-card sf-login-card" onSubmit={submit}>
        <div className="slds-card__body slds-card__body_inner">
          <div className="slds-align_absolute-center slds-m-bottom_medium" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'center' }}>
            <img src="/logo.svg" alt="" width={48} height={48} />
            <h1 className="slds-text-heading_medium">Salesfroge</h1>
          </div>
          <p className="sf-muted slds-m-bottom_medium">Sign in with your email. The demo company is ready: avery@salesfroge.local / salesfroge</p>
          {error && <p className="sf-error">{error}</p>}
          <div className="slds-form-element slds-m-bottom_small">
            <label className="slds-form-element__label" htmlFor="email">Email</label>
            <input id="email" className="slds-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="slds-form-element slds-m-bottom_medium">
            <label className="slds-form-element__label" htmlFor="password">Password</label>
            <input id="password" className="slds-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="slds-button slds-button_brand slds-button_stretch" type="submit">Log in</button>
          {google && <a className="slds-button slds-button_neutral slds-button_stretch slds-m-top_small" href={`${API_URL}/auth/google`}>Sign in with Google</a>}
          <p className="slds-m-top_medium slds-text-align_center">New here? <Link href="/register">Create an account</Link></p>
        </div>
      </form>
    </div>
  );
}
