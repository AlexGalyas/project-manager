'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Github } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Tooltip } from '@/components/ui';
import { navForRole, type NavItem } from './nav-config';
import styles from './Sidebar.module.scss';

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);

  if (!user) return null;
  const sections = navForRole(user.role);

  return (
    <aside className={clsx(styles.sidebar, collapsed && styles.collapsed)}>
      <nav className={styles.nav} aria-label="Primary">
        {sections.map((sec) => (
          <div key={sec.label} className={styles.section}>
            <p className={styles.sectionLabel}>{sec.label}</p>
            <ul className={styles.list}>
              {sec.items.map((it) => (
                <li key={it.href}>
                  <NavLink
                    item={it}
                    active={isActive(pathname, it.href)}
                    collapsed={collapsed}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <footer className={styles.footer}>
        <Link
          href="https://github.com/AlexGalyas/project-manager"
          target="_blank"
          rel="noreferrer"
          className={styles.footerLink}
          aria-label="View on GitHub"
        >
          <Github size={14} />
          {!collapsed && <span>v0.1 · GitHub</span>}
        </Link>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </footer>
    </aside>
  );
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const inner = (
    <Link
      href={item.href}
      className={clsx(styles.link, active && styles.linkActive)}
      aria-current={active ? 'page' : undefined}
    >
      <span className={styles.linkIcon} aria-hidden>
        <Icon size={16} />
      </span>
      {!collapsed && <span className={styles.linkLabel}>{item.label}</span>}
      {active && <span className={styles.activeBar} aria-hidden />}
    </Link>
  );
  if (collapsed) {
    return (
      <Tooltip content={item.label} side="right">
        {inner}
      </Tooltip>
    );
  }
  return inner;
}

function isActive(pathname: string, href: string): boolean {
  if (href === pathname) return true;
  // Avoid `'/admin'` matching `'/admin/users'` falsely: only match prefix when
  // followed by slash.
  return pathname.startsWith(`${href}/`);
}
