'use client';

import clsx from 'clsx';
import { Breadcrumbs, type BreadcrumbItem } from '../Breadcrumbs';
import styles from './PageContainer.module.scss';

export interface PageContainerProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  /** Reduce the max-width for narrower forms (e.g. /admin/users/new). */
  size?: 'default' | 'narrow' | 'wide';
  className?: string;
  children: React.ReactNode;
}

export function PageContainer({
  title,
  description,
  actions,
  breadcrumbs,
  size = 'default',
  className,
  children,
}: PageContainerProps) {
  const hasHeader = Boolean(title || description || actions || breadcrumbs);
  return (
    <main className={clsx(styles.root, styles[`size_${size}`], className)}>
      {hasHeader && (
        <header className={styles.header}>
          {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
          <div className={styles.titleRow}>
            <div className={styles.titleText}>
              {title && <h1 className={styles.title}>{title}</h1>}
              {description && <p className={styles.description}>{description}</p>}
            </div>
            {actions && <div className={styles.actions}>{actions}</div>}
          </div>
        </header>
      )}
      <div className={styles.content}>{children}</div>
    </main>
  );
}
