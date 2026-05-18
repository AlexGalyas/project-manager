'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { Button, Card, CardBody, Input } from '@/components/ui';
import styles from './page.module.scss';

interface DemoCred {
  role: 'Admin' | 'Manager' | 'Employee';
  email: string;
}

const DEMO_CREDS: DemoCred[] = [
  { role: 'Admin', email: 'admin@demo.local' },
  { role: 'Manager', email: 'manager1@demo.local' },
  { role: 'Employee', email: 'emp1@demo.local' },
];

const DEMO_PASSWORD = 'password';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);

  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed');
    }
  }

  function fillDemo(cred: DemoCred) {
    setEmail(cred.email);
    setPassword(DEMO_PASSWORD);
    setErrorMessage(null);
  }

  return (
    <main className={styles.page}>
      <div className={styles.gradient} aria-hidden />
      <Card className={styles.card} padding="lg">
        <header className={styles.brand}>
          <span className={styles.logoMark} aria-hidden>
            <Sparkles size={18} />
          </span>
          <h1 className={styles.title}>Workforce Optimizer</h1>
          <p className={styles.subtitle}>Sign in to continue.</p>
        </header>

        <CardBody>
          <form onSubmit={handleSubmit} noValidate className={styles.form}>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={14} />}
              placeholder="you@demo.local"
              required
            />
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={14} />}
              required
              rightSlot={
                <button
                  type="button"
                  className={styles.eye}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />

            {errorMessage && (
              <p role="alert" className={styles.alert}>
                {errorMessage}
              </p>
            )}

            <Button type="submit" loading={loading} fullWidth size="lg">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardBody>

        <footer className={styles.demoFooter}>
          <p className={styles.demoLabel}>Demo accounts · click to fill</p>
          <ul className={styles.demoList}>
            {DEMO_CREDS.map((c) => (
              <li key={c.email}>
                <button
                  type="button"
                  className={styles.demoBtn}
                  onClick={() => fillDemo(c)}
                >
                  <span className={styles.demoRole}>{c.role}</span>
                  <span className={styles.demoEmail}>{c.email}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.demoHint}>
            Password for all demo accounts: <code>password</code>
          </p>
        </footer>
      </Card>
    </main>
  );
}
