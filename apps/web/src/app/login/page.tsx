'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import styles from './page.module.scss';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);

  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('password');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    try {
      const user = await login(email, password);
      // Role-based dashboards are introduced in Phase 3; for now everyone
      // lands on the root, which renders a profile + logout view.
      const target = user.role === 'ADMIN' ? '/' : user.role === 'MANAGER' ? '/' : '/';
      router.push(target);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <main className={styles.main}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <LogIn size={24} />
          <h1>Workforce Optimizer</h1>
        </header>
        <p className={styles.subtitle}>Sign in to continue</p>

        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {errorMessage && <p className={styles.error}>{errorMessage}</p>}

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className={styles.hint}>
          Demo: <code>admin@demo.local</code> / <code>password</code>
          <br />
          Also <code>manager1@demo.local</code>, <code>emp1@demo.local</code> … <code>emp15@demo.local</code>.
        </p>
      </form>
    </main>
  );
}
