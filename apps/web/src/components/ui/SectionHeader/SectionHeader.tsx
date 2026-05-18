'use client';

import clsx from 'clsx';
import styles from './SectionHeader.module.scss';

export interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}

export function SectionHeader({
  title,
  description,
  action,
  as = 'h2',
  className,
}: SectionHeaderProps) {
  const Heading = as;
  return (
    <div className={clsx(styles.root, className)}>
      <div className={styles.text}>
        <Heading className={clsx(styles.heading, as === 'h2' ? styles.h2 : styles.h3)}>
          {title}
        </Heading>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
