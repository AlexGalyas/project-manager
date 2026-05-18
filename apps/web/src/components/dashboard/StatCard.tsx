'use client';

import clsx from 'clsx';
import { Card } from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';
import styles from './StatCard.module.scss';

export interface StatCardProps {
  label: string;
  /** Display value. Use `null` to render a skeleton (loading) state. */
  value: React.ReactNode | null;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
}

export function StatCard({ label, value, icon, description, tone = 'default' }: StatCardProps) {
  return (
    <Card className={clsx(styles.card, styles[`tone_${tone}`])} padding="md">
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      <div className={styles.value}>
        {value === null ? <Skeleton width={80} height={26} /> : value}
      </div>
      {description && <div className={styles.description}>{description}</div>}
    </Card>
  );
}
