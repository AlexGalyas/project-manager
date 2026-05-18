'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/stores/auth-store';
import {
  useThemeStore,
  type ThemePreference,
} from '@/stores/theme-store';
import { Avatar, Dropdown, type DropdownEntry } from '@/components/ui';
import styles from './Header.module.scss';

const THEME_OPTIONS: Array<{ value: ThemePreference; icon: React.ReactNode; label: string }> = [
  { value: 'light', icon: <Sun size={12} />, label: 'Light' },
  { value: 'system', icon: <Monitor size={12} />, label: 'System' },
  { value: 'dark', icon: <Moon size={12} />, label: 'Dark' },
];

export function Header() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className={styles.header}>
      <Link href={user ? '/' : '/login'} className={styles.brand}>
        <span className={styles.dot} aria-hidden />
        <span className={styles.brandLabel}>Workforce Optimizer</span>
      </Link>

      <div className={styles.right}>
        {user && (
          <Dropdown
            align="end"
            minWidth={240}
            trigger={
              <button type="button" className={styles.userTrigger} aria-label="Open user menu">
                <Avatar name={user.fullName} size="sm" />
                <span className={styles.userName}>{user.fullName}</span>
              </button>
            }
            menuHeader={
              <div className={styles.identity}>
                <span className={styles.identityName}>{user.fullName}</span>
                <span className={styles.identityEmail}>{user.email}</span>
                <span className={styles.identityRole}>{user.role.toLowerCase()}</span>
              </div>
            }
            menuFooter={<ThemeSegment />}
            items={[
              {
                label: 'Sign out',
                icon: <LogOut size={14} />,
                onSelect: () => {
                  logout();
                  router.replace('/login');
                },
              },
            ]}
          />
        )}
      </div>
    </header>
  );
}

function ThemeSegment() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  return (
    <div className={styles.themeSegment} role="radiogroup" aria-label="Theme">
      <span className={styles.themeLabel}>Theme</span>
      <div className={styles.themeBtns}>
        {THEME_OPTIONS.map((opt) => {
          const active = preference === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${opt.label} theme`}
              title={opt.label}
              className={clsx(styles.themeBtn, active && styles.themeBtnActive)}
              onClick={() => setPreference(opt.value)}
            >
              {opt.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}
