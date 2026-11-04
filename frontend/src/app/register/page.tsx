'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setToken } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await api('/auth/register', { method: 'POST', body: form });
      setToken(result.token);
      router.replace('/');
    } catch (err: any) {
      setError(err.message);
    }
  }

  function set(key: string, value: string) { setForm({ ...form, [key]: value }); }

  return (
    <div className="sf-login">
      <form className="slds-card sf-login-card" onSubmit={submit}>
        <div className="slds-card__body slds-card__body_inner">
          <h1 className="slds-text-heading_medium slds-m-bottom_medium">Create your Salesfroge account</h1>
          {error && <p className="sf-error">{error}</p>}
          <input className="slds-input slds-m-bottom_x-small" placeholder="First name" required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          <input className="slds-input slds-m-bottom_x-small" placeholder="Last name" required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          <input className="slds-input slds-m-bottom_x-small" type="email" placeholder="Email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
          <input className="slds-input slds-m-bottom_medium" type="password" placeholder="Password (6+ characters)" required minLength={6} value={form.password} onChange={(e) => set('password', e.target.value)} />
          <button className="slds-button slds-button_brand slds-button_stretch" type="submit">Sign up</button>
          <p className="slds-m-top_medium slds-text-align_center"><Link href="/login">Back to login</Link></p>
        </div>
      </form>
    </div>
  );
}
