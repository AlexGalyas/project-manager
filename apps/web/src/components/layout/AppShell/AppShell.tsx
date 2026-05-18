'use client';

import { useSidebarStore } from '@/stores/sidebar-store';
import { Header } from '../Header';
import { Sidebar } from '../Sidebar';
import styles from './AppShell.module.scss';
import clsx from 'clsx';

export interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Two-column app chrome (Header spanning full width on top, Sidebar on the
 * left, content on the right). Used by the (authed) route group from Step 8
 * onwards. Public routes like /login render outside this shell.
 */
export function AppShell({ children }: AppShellProps) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  return (
    <div className={clsx(styles.shell, collapsed && styles.shellCollapsed)}>
      <Header />
      <Sidebar />
      <div className={styles.main}>{children}</div>
    </div>
  );
}
