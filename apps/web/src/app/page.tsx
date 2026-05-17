'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import styles from './page.module.scss';

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }
    // Refresh profile from /auth/me so a stale localStorage user is corrected.
    void fetchMe();
  }, [token, router, fetchMe]);

  if (!token || !user) {
    return (
      <main className={styles.main}>
        <p className={styles.muted}>Redirecting…</p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1>Workforce Optimizer</h1>
        <p>
          Signed in as <strong>{user.fullName}</strong> ({user.role.toLowerCase()})
        </p>
        <p className={styles.muted}>
          Phase 2 complete — Phase 3 will replace this landing with role-based dashboards.
        </p>
        <button
          type="button"
          className={styles.logout}
          onClick={() => {
            logout();
            router.replace('/login');
          }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </section>
    </main>
  );
}
