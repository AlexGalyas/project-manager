'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Role } from '@workforce/shared';
import { useAuthStore } from '@/stores/auth-store';
import { Nav } from '@/components/Nav';
import { Spinner } from '@/components/Spinner';
import styles from './layout.module.scss';

function rolePrefix(role: Role): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'MANAGER') return '/manager';
  return '/employee';
}

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }
    if (!user) {
      void fetchMe();
    }
  }, [token, user, router, fetchMe]);

  // Role-gating: an EMPLOYEE who lands on /admin/users should bounce home.
  useEffect(() => {
    if (!user) return;
    const allowedRoots: string[] = [];
    if (user.role === 'ADMIN') allowedRoots.push('/admin', '/manager', '/employee');
    if (user.role === 'MANAGER') allowedRoots.push('/manager', '/employee');
    if (user.role === 'EMPLOYEE') allowedRoots.push('/employee');
    const ok = allowedRoots.some(
      (root) => pathname === root || pathname.startsWith(`${root}/`),
    );
    if (!ok) router.replace(rolePrefix(user.role));
  }, [user, pathname, router]);

  if (!token || !user) {
    return (
      <div className={styles.shell}>
        <div className={styles.loading}>
          <Spinner size={24} label="Loading session" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <Nav />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
