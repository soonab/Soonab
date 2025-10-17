'use client';

import { useState } from 'react';

export default function AuthRequestPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Requesting link...');
    setLink(null);
    try {
      const res = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) {
        setLink(data.link);
        setStatus('Check the link below (dev mode).');
      } else {
        setStatus(data.error || 'Failed to request link.');
      }
    } catch (err) {
      console.error('Failed to request sign-in link', err);
      setStatus('Network error.');
    }
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border bg-transparent p-2"
          required
        />
        <button className="rounded border px-3 py-1">Email me a magic link</button>
      </form>
      {status && <p className="text-sm text-gray-400">{status}</p>}
      {link && (
        <p className="text-sm">
          Dev link:&nbsp;
          <a className="underline" href={link}>{link}</a>
        </p>
      )}
    </main>
  );
}
