'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { parentLogin } from '../actions';

export function ParentLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await parentLogin(new FormData(e.currentTarget));
      if (result.ok) {
        router.replace('/parent');
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
        Guardian phone number
        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required autoFocus />
      </label>
      <label>
        PIN
        <input name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="current-password" placeholder="6 digits" required />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-btn login-btn" disabled={pending}>
        {pending ? 'Logging in…' : <>Log in <ArrowRight size={15} /></>}
      </button>
    </form>
  );
}
