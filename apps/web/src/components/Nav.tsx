'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import styles from './Nav.module.scss';

interface NavLinkDef {
  href: string;
  label: string;
}

const LINKS_BY_ROLE: Record<'ADMIN' | 'MANAGER' | 'EMPLOYEE', NavLinkDef[]> = {
  ADMIN: [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users' },
    { href: '/manager/projects', label: 'Projects' },
    { href: '/manager/optimizer', label: 'Optimizer' },
  ],
  MANAGER: [
    { href: '/manager', label: 'Dashboard' },
    { href: '/manager/projects', label: 'Projects' },
    { href: '/manager/optimizer', label: 'Optimizer' },
  ],
  EMPLOYEE: [
    { href: '/employee', label: 'Dashboard' },
    { href: '/employee/tasks', label: 'My tasks' },
    { href: '/employee/projects', label: 'My projects' },
  ],
};

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  const links = LINKS_BY_ROLE[user.role];

  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        <span className={styles.dot} aria-hidden />
        Workforce Optimizer
      </div>
      <ul className={styles.links}>
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <li key={l.href}>
              <Link href={l.href} className={active ? styles.linkActive : styles.link}>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className={styles.user}>
        <span className={styles.userName}>
          {user.fullName} <span className={styles.role}>· {user.role.toLowerCase()}</span>
        </span>
        <button
          type="button"
          className={styles.signout}
          onClick={() => {
            logout();
            router.replace('/login');
          }}
          aria-label="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}
