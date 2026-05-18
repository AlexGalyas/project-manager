'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import styles from './Breadcrumbs.module.scss';

export interface BreadcrumbItem {
  label: React.ReactNode;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={clsx(styles.root, className)}>
      <ol>
        {items.map((it, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i}>
              {it.href && !isLast ? (
                <Link href={it.href} className={styles.link}>
                  {it.label}
                </Link>
              ) : (
                <span className={isLast ? styles.current : styles.text} aria-current={isLast ? 'page' : undefined}>
                  {it.label}
                </span>
              )}
              {!isLast && (
                <span className={styles.separator} aria-hidden>
                  <ChevronRight size={12} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
