'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { login } from './actions';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await login(new FormData(e.currentTarget));
      if (result.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      setError(result.error);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setPending(false);
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-btn login-btn" disabled={pending}>
        {pending ? 'Logging in…' : <>Log in <ArrowRight size={15} /></>}
      </button>
    </form>
  );
}
